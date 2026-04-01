require('dotenv').config();
const express    = require('express');
let webpush; try { webpush = require('web-push'); } catch(e) { webpush = null; }
const { Database: _WasmDB } = require('node-sqlite3-wasm');
// Shim: aceita args variádicos como better-sqlite3
function Database(path) {
  const db = new _WasmDB(path);
  const _prep = db.prepare.bind(db);
  db.prepare = (sql) => {
    const s = _prep(sql);
    const patch = (fn) => (...a) => fn(a.length > 1 ? a : a[0]);
    s.run = patch(s.run.bind(s));
    s.get = patch(s.get.bind(s));
    s.all = patch(s.all.bind(s));
    return s;
  };
  return db;
}
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors       = require('cors');
const helmet     = require('helmet');
let multer; try { multer = require('multer'); } catch(e) { multer = null; }
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const fs         = require('fs');

const app  = express();
app.set('trust proxy', 1); // Railway usa proxy — necessário para rate-limit e IPs corretos
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'alliance_crm_secret_2024_troque_isto';

// ── Web Push (VAPID) ──────────────────────────────────────────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || 'BP_rJ02L19z2zzg7SmsoQa0gLh8WnH1N1KZapjBxa17mtOGh88jQ5NAJ0k4m20KpCs5ouVuxj-0OMMEihwp63No';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'wV8WTNS7bXjDjnwEf9nDl0-unfXlFoAbW0KTk8opCQU';
if (webpush) webpush.setVapidDetails('mailto:admin@gruporm.com', VAPID_PUBLIC, VAPID_PRIVATE);
const DB_PATH    = process.env.DB_PATH || (process.platform === 'win32' ? path.join(__dirname, 'alliance.db') : '/data/alliance.db');
const UPLOAD_DIR = process.env.UPLOAD_DIR || (process.platform === 'win32' ? path.join(__dirname, 'uploads') : '/data/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Multer (upload de arquivos) ───────────────────────────────────────────────
let upload = null;
if (multer) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + ext);
    }
  });
  upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });
}

// ── Garantir diretório do banco ───────────────────────────────────────────────
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// ── Banco de dados ────────────────────────────────────────────────────────────
// Remove lock file órfão (qualquer plataforma) — evita "database is locked" no redeploy
try { fs.rmSync(DB_PATH + '.lock', { recursive: true, force: true }); } catch(e) {}
try { fs.rmSync(DB_PATH + '-wal', { force: true }); } catch(e) {}
try { fs.rmSync(DB_PATH + '-shm', { force: true }); } catch(e) {}

// Tentar abrir o banco com retry (Railway pode ter dois containers brevemente)
let db;
for (let _try = 0; _try < 10; _try++) {
  try {
    db = new Database(DB_PATH);
    break;
  } catch(e) {
    if (_try >= 9) throw e;
    // Espera síncrona de 1s (Atomics trick compatível com Node)
    const shared = new Int32Array(new SharedArrayBuffer(4));
    Atomics.wait(shared, 0, 0, 1000);
  }
}
try { db.exec('PRAGMA journal_mode=WAL'); } catch(e) {}
try { db.exec('PRAGMA busy_timeout=5000'); } catch(e) {}
try { db.exec('PRAGMA foreign_keys = ON'); } catch(e) {}

// Separado em chamadas individuais — node-sqlite3-wasm não suporta multi-statement exec
db.exec(`CREATE TABLE IF NOT EXISTS usuarios (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nome         TEXT NOT NULL,
  usuario      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  senha_hash   TEXT NOT NULL,
  cargo        TEXT DEFAULT 'Atendente',
  role         TEXT DEFAULT 'atendente',
  setor        TEXT DEFAULT 'recepcao',
  ativo        INTEGER DEFAULT 1,
  criado_em    TEXT DEFAULT (datetime('now','localtime')),
  ultimo_acesso TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS leads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nome            TEXT NOT NULL,
  telefone        TEXT,
  origem          TEXT DEFAULT 'Manual',
  status          TEXT DEFAULT 'LEAD',
  motivo          TEXT,
  oculos          TEXT DEFAULT 'Sim',
  valor           REAL DEFAULT 20,
  os              TEXT,
  unidade         TEXT DEFAULT 'Conquista',
  criado_em       TEXT DEFAULT (datetime('now','localtime')),
  atualizado_em   TEXT DEFAULT (datetime('now','localtime'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS vendas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id         INTEGER,
  cliente_nome    TEXT,
  valor           REAL NOT NULL,
  pagamento       TEXT DEFAULT 'PIX',
  servico         TEXT,
  tipo            TEXT DEFAULT 'Venda',
  tipo_cobranca   TEXT DEFAULT 'Integral',
  data_entrega_video TEXT,
  criado_por      INTEGER,
  criado_em       TEXT DEFAULT (datetime('now','localtime'))
)`);
// Adicionar colunas novas em bancos existentes (ignorar erro se já existe)
try { db.exec("ALTER TABLE vendas ADD COLUMN tipo_cobranca TEXT DEFAULT 'Integral'"); } catch(e) {}
try { db.exec("ALTER TABLE vendas ADD COLUMN data_entrega_video TEXT"); } catch(e) {}
db.exec(`CREATE TABLE IF NOT EXISTS agendamentos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id         INTEGER,
  cliente_nome    TEXT,
  cliente_tel     TEXT,
  servico         TEXT,
  data            TEXT,
  hora            TEXT,
  status          TEXT DEFAULT 'scheduled',
  nota            TEXT,
  criado_em       TEXT DEFAULT (datetime('now','localtime'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS chat_msgs (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  canal    TEXT NOT NULL,
  autor    TEXT NOT NULL,
  setor    TEXT,
  texto    TEXT NOT NULL,
  tipo     TEXT DEFAULT 'msg',
  paciente TEXT,
  destino  TEXT,
  nota     TEXT,
  lido     INTEGER DEFAULT 0,
  criado_em TEXT DEFAULT (datetime('now','localtime'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT
)`);

// Tabela de contas WhatsApp Meta (múltiplas contas)
db.exec(`CREATE TABLE IF NOT EXISTS wpp_contas (
  id       TEXT PRIMARY KEY,
  nome     TEXT,
  token    TEXT,
  phone_id TEXT,
  biz_id   TEXT,
  numero   TEXT,
  ativo    INTEGER DEFAULT 1,
  criado_em TEXT DEFAULT (datetime('now','localtime'))
)`);

// Inserir conta padrão Alliance se não existir
try {
  const contaExiste = db.prepare("SELECT id,token FROM wpp_contas WHERE phone_id='1025821790609502'").get();
  if (!contaExiste) {
    db.prepare(`INSERT INTO wpp_contas (id,nome,phone_id,biz_id,numero,ativo) VALUES (?,?,?,?,?,1)`)
      .run('alliance-principal', 'Alliance Optometria BA', '1025821790609502', '789454576960299', '+55 77 81611475');
  }
  // Migração: se alliance-principal não tem token, tenta recuperar do config global
  const contaAlliance = db.prepare("SELECT id,token FROM wpp_contas WHERE id='alliance-principal'").get();
  if (contaAlliance && !contaAlliance.token) {
    const cfgRow = db.prepare("SELECT valor FROM config WHERE chave='whatsapp_meta'").get();
    if (cfgRow) {
      try {
        const cfg = JSON.parse(cfgRow.valor);
        if (cfg.token) {
          db.prepare("UPDATE wpp_contas SET token=?,phone_id=?,biz_id=? WHERE id='alliance-principal'")
            .run(cfg.token, cfg.phoneId||'1025821790609502', cfg.bizId||'789454576960299');
          console.log('✅ Token da Alliance recuperado do config e aplicado à conta.');
        }
      } catch(e) {}
    }
  }
} catch(e) { console.error('Erro ao configurar conta Alliance:', e.message); }

// Tabela de mensagens WhatsApp (Meta Cloud API)
db.exec(`CREATE TABLE IF NOT EXISTS wpp_mensagens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  wamid       TEXT UNIQUE,
  de          TEXT NOT NULL,
  nome        TEXT,
  para        TEXT,
  conta_id    TEXT,
  texto       TEXT,
  tipo        TEXT DEFAULT 'text',
  direcao     TEXT DEFAULT 'recebida',
  lido        INTEGER DEFAULT 0,
  criado_em   TEXT DEFAULT (datetime('now','localtime'))
)`);
try { db.exec("ALTER TABLE wpp_mensagens ADD COLUMN conta_id TEXT"); } catch(e) {}

// Tabela de transferências de conversas
db.exec(`CREATE TABLE IF NOT EXISTS wpp_transferencias (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversa_de     TEXT NOT NULL,
  de_usuario      TEXT NOT NULL,
  de_nome         TEXT NOT NULL,
  para_usuario    TEXT NOT NULL,
  para_nome       TEXT NOT NULL,
  de_setor        TEXT,
  para_setor      TEXT,
  motivo          TEXT,
  criado_em       TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(conversa_de, criado_em)
)`);

// ════════════════════════════════════════════════════════════════════════════════
// INSTAGRAM DIRECT MESSAGES
// ════════════════════════════════════════════════════════════════════════════════

// Tabela de mensagens Instagram
db.exec(`CREATE TABLE IF NOT EXISTS instagram_mensagens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  igid        TEXT UNIQUE,
  de          TEXT NOT NULL,
  nome        TEXT,
  username    TEXT,
  texto       TEXT,
  tipo        TEXT DEFAULT 'text',
  direcao     TEXT DEFAULT 'recebida',
  lido        INTEGER DEFAULT 0,
  criado_em   TEXT DEFAULT (datetime('now','localtime'))
)`);

// Tabela de conversas Instagram (para rastrear conta)
db.exec(`CREATE TABLE IF NOT EXISTS instagram_contas (
  id              TEXT PRIMARY KEY,
  nome            TEXT,
  username        TEXT,
  business_id     TEXT,
  token           TEXT,
  ativo           INTEGER DEFAULT 1,
  criado_em       TEXT DEFAULT (datetime('now','localtime'))
)`);

// Tabela de transferências Instagram
db.exec(`CREATE TABLE IF NOT EXISTS instagram_transferencias (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversa_de     TEXT NOT NULL,
  de_usuario      TEXT NOT NULL,
  de_nome         TEXT NOT NULL,
  para_usuario    TEXT NOT NULL,
  para_nome       TEXT NOT NULL,
  de_setor        TEXT,
  para_setor      TEXT,
  motivo          TEXT,
  criado_em       TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(conversa_de, criado_em)
)`);

// ════════════════════════════════════════════════════════════════════════════════
// NOVAS TABELAS - DASHBOARD v2
// ════════════════════════════════════════════════════════════════════════════════

// Tabela de rastreamento de pagamentos
db.exec(`CREATE TABLE IF NOT EXISTS pagamentos (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  venda_id            INTEGER UNIQUE,
  cliente_nome        TEXT,
  valor               REAL,
  data_pagamento      DATE,
  forma_pagamento     TEXT,
  data_entrega_video  DATE,
  status              TEXT DEFAULT 'AGUARDANDO',
  criado_em           TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY(venda_id) REFERENCES vendas(id)
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_pagamentos_venda ON pagamentos(venda_id)"); } catch(e) {}

// Tabela de rastreamento de vídeos
db.exec(`CREATE TABLE IF NOT EXISTS videos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  venda_id          INTEGER,
  cliente_nome      TEXT,
  tipo              TEXT,
  url               TEXT,
  data_entrega      DATE,
  status            TEXT DEFAULT 'ENVIADO',
  criado_em         TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY(venda_id) REFERENCES vendas(id)
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_videos_venda ON videos(venda_id)"); } catch(e) {}

// Tabela de indicações (cliente indica outro)
db.exec(`CREATE TABLE IF NOT EXISTS indicacoes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  venda_id_indicador  INTEGER,
  novo_cliente_nome   TEXT,
  novo_cliente_tel    TEXT,
  status              TEXT DEFAULT 'LEAD',
  data_conversao      DATE,
  quem_indicou        TEXT DEFAULT '',
  indicado_para       TEXT DEFAULT '',
  desconto_percentual REAL DEFAULT 0,
  criado_em           TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY(venda_id_indicador) REFERENCES vendas(id)
)`);
// Migrações para campos novos da tabela indicacoes
try { db.exec("ALTER TABLE indicacoes ADD COLUMN quem_indicou TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE indicacoes ADD COLUMN indicado_para TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE indicacoes ADD COLUMN desconto_percentual REAL DEFAULT 0"); } catch(e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_indicacoes_venda ON indicacoes(venda_id_indicador)"); } catch(e) {}

// Tabela de pontuação de atendentes (calculada automaticamente)
db.exec(`CREATE TABLE IF NOT EXISTS pontuacao_atendentes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id        INTEGER,
  venda_id          INTEGER,
  pontos            INTEGER,
  faixa_valor       TEXT,
  data              DATE,
  criado_em         TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY(venda_id) REFERENCES vendas(id)
)`);

// Tabela de ranking fixo (Daniel, Gabriel, Pedro, Kim)
db.exec(`CREATE TABLE IF NOT EXISTS ranking (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       TEXT NOT NULL UNIQUE,
  vendas     INTEGER DEFAULT 0,
  pontos     REAL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now','localtime'))
)`);

// Inserir os 4 atendentes do ranking se não existirem
(function seedRanking() {
  const nomes = ['Daniel', 'Gabriel', 'Pedro', 'Kim'];
  const stmt = db.prepare("SELECT id FROM ranking WHERE nome=?");
  const ins  = db.prepare("INSERT INTO ranking (nome, vendas, pontos) VALUES (?,0,0)");
  nomes.forEach(n => { if (!stmt.get(n)) ins.run(n); });
})();
try { db.exec("CREATE INDEX IF NOT EXISTS idx_pontuacao_usuario ON pontuacao_atendentes(usuario_id)"); } catch(e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_pontuacao_data ON pontuacao_atendentes(data)"); } catch(e) {}

// Tabela de metas globais da empresa
db.exec(`CREATE TABLE IF NOT EXISTS metas_globais (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo           TEXT,
  tipo              TEXT,
  valor_meta        REAL,
  valor_realizado   REAL DEFAULT 0,
  mes_ano           DATE,
  criado_em         TEXT DEFAULT (datetime('now','localtime'))
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_metas_periodo ON metas_globais(periodo, mes_ano)"); } catch(e) {}

// Tabela de serviços no banco (lista padrão)
db.exec(`CREATE TABLE IF NOT EXISTS servicos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       TEXT NOT NULL,
  preco      REAL DEFAULT 0,
  descricao  TEXT DEFAULT '',
  cor        TEXT DEFAULT '#2563eb',
  ativo      INTEGER DEFAULT 1,
  criado_em  TEXT DEFAULT (datetime('now','localtime'))
)`);

// Seed dos serviços padrão LS Impulsiona
(function seedServicos() {
  const count = db.prepare("SELECT COUNT(*) as c FROM servicos").get().c;
  if (count === 0) {
    const ins = db.prepare("INSERT INTO servicos (nome, preco, descricao, cor) VALUES (?,?,?,?)");
    ins.run('Pacote 4 Vídeos Persuasivos', 997,  'Pacote com 4 vídeos persuasivos para marketing', '#2563eb');
    ins.run('Pacote 5 Vídeos Persuasivos', 1297, 'Pacote com 5 vídeos persuasivos para marketing', '#3b82f6');
    ins.run('Pacote 6 Vídeos Persuasivos', 1597, 'Pacote com 6 vídeos persuasivos para marketing', '#6366f1');
    ins.run('Pacote 7 Vídeos Persuasivos', 1997, 'Pacote com 7 vídeos persuasivos para marketing', '#8b5cf6');
    ins.run('Tráfego Pago',                800,  'Gestão de tráfego pago e anúncios',              '#f97316');
    ins.run('Social Media',                600,  'Gestão de redes sociais',                        '#f59e0b');
    ins.run('Automação',                   1500, 'Automação de marketing e processos',              '#10b981');
    ins.run('CRM',                         300,  'Sistema CRM e gestão de clientes',               '#0d9488');
  }
})();

// ── Forçar serviços corretos LS Impulsiona ────────────────────────────────────
// Os serviços ficam no config.services (JSON) — apagamos a entrada antiga para
// o frontend usar seus defaults corretos (Pacote 4/5/6/7 Vídeos, etc.)
try {
  const svVer = db.prepare("SELECT valor FROM config WHERE chave='servicos_version'").get();
  if (!svVer || svVer.valor !== 'ls-v4') {
    // Substituir config.services pelos serviços corretos da LS Impulsiona
    const lsServices = JSON.stringify([
      {id:'s1',name:'Pacote 4 Vídeos Persuasivos',duration:30,price:997,  color:'#2563eb',description:'Pacote com 4 vídeos persuasivos para marketing'},
      {id:'s2',name:'Pacote 5 Vídeos Persuasivos',duration:30,price:1297, color:'#3b82f6',description:'Pacote com 5 vídeos persuasivos para marketing'},
      {id:'s3',name:'Pacote 6 Vídeos Persuasivos',duration:30,price:1597, color:'#6366f1',description:'Pacote com 6 vídeos persuasivos para marketing'},
      {id:'s4',name:'Pacote 7 Vídeos Persuasivos',duration:30,price:1997, color:'#8b5cf6',description:'Pacote com 7 vídeos persuasivos para marketing'},
      {id:'s5',name:'Tráfego Pago',               duration:0, price:800,  color:'#f97316',description:'Gestão de tráfego pago e anúncios'},
      {id:'s6',name:'Social Media',                duration:0, price:600,  color:'#f59e0b',description:'Gestão de redes sociais'},
      {id:'s7',name:'Automação',                   duration:0, price:1500, color:'#10b981',description:'Automação de marketing e processos'},
      {id:'s8',name:'CRM',                         duration:0, price:300,  color:'#0d9488',description:'Sistema CRM e gestão de clientes'},
    ]);
    db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('services',?)").run(lsServices);
    db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('servicos_version','ls-v4')").run();
    console.log('Serviços LS Impulsiona atualizados (ls-v4)');
  }
} catch(e) { console.error('Erro ao corrigir serviços:', e.message); }

// ── Migrações de schema ───────────────────────────────────────────────────────
try { db.exec("ALTER TABLE leads ADD COLUMN unidade TEXT DEFAULT 'Conquista'"); } catch(e) { /* já existe */ }

// ── Índices de otimização ───────────────────────────────────────────────────────
// Vendas
try { db.exec("CREATE INDEX IF NOT EXISTS idx_vendas_criado_por ON vendas(criado_por)"); } catch(e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(criado_em)"); } catch(e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_vendas_lead ON vendas(lead_id)"); } catch(e) {}

// Leads
try { db.exec("CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)"); } catch(e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_leads_data ON leads(criado_em)"); } catch(e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_leads_telefone ON leads(telefone)"); } catch(e) {}

// WhatsApp/Instagram
try { db.exec("CREATE INDEX IF NOT EXISTS idx_wpp_msg_de ON wpp_mensagens(de)"); } catch(e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_wpp_msg_data ON wpp_mensagens(criado_em)"); } catch(e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_ig_msg_de ON instagram_mensagens(de)"); } catch(e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_ig_msg_data ON instagram_mensagens(criado_em)"); } catch(e) {}

// Usuários
try { db.exec("CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON usuarios(ativo)"); } catch(e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios(role)"); } catch(e) {}

// ── Usuários padrão ───────────────────────────────────────────────────────────
const DEFAULTS = [
  { nome:'Lary Soares',  usuario:'lary',      senha:'admin123',  cargo:'Administrador', role:'admin',        setor:'gestao'   },
  { nome:'Gestor',       usuario:'gestor',     senha:'gestor123', cargo:'Gestor',        role:'gestor',       setor:'gestao'   },
  { nome:'Atendente',    usuario:'atendente',  senha:'atend123',  cargo:'Atendente',     role:'atendente',    setor:'recepcao' },
  { nome:'Vendedor',     usuario:'vendedor',   senha:'vend123',   cargo:'Vendedor',      role:'vendedor',     setor:'vendas'   },
];
const stmtCheck = db.prepare('SELECT id FROM usuarios WHERE usuario=?');
const stmtInsert = db.prepare('INSERT INTO usuarios (nome,usuario,senha_hash,cargo,role,setor) VALUES (?,?,?,?,?,?)');
for (const u of DEFAULTS) {
  if (!stmtCheck.get(u.usuario)) {
    stmtInsert.run(u.nome, u.usuario, bcrypt.hashSync(u.senha, 12), u.cargo, u.role, u.setor);
  }
}

// ── Permissões ────────────────────────────────────────────────────────────────
const PERMISSOES = {
  admin:    ['dashboard','leads','faturamento','setores','servicos','whatsapp','atendimentos','config','usuarios','que-chegou','se-converteu','videos','indicacoes','ranking'],
  gestor:   ['dashboard','leads','faturamento','setores','servicos','whatsapp','atendimentos','config','usuarios','que-chegou','se-converteu','videos','indicacoes','ranking'],
  gerente:  ['dashboard','leads','setores','servicos','whatsapp','atendimentos','config','que-chegou','se-converteu','videos','indicacoes','ranking'],
  atendente:['dashboard','leads','whatsapp','atendimentos','que-chegou','se-converteu','videos','indicacoes','ranking'],
  vendedor: ['dashboard','leads','whatsapp','atendimentos','que-chegou','se-converteu','videos','indicacoes','ranking'],
  optometrista:['dashboard','leads','whatsapp','atendimentos','que-chegou','se-converteu','videos','indicacoes','ranking'],
};

// ── Middlewares ───────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // CRM usa inline scripts
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: 'Rate limit excedido.' },
});

// Rate limit específico para o endpoint da IA (mais restritivo)
const iaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Rate limit da IA excedido.' },
});

app.use('/api/', apiLimiter);

// ── Auth middleware ───────────────────────────────────────────────────────────
// ── Fetch com timeout (10s) para evitar que chamadas externas travem o servidor ──
function fetchComTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function auth(req, res, next) {
  const token = req.cookies?.crm_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie('crm_token');
    return res.status(401).json({ error: 'Sessão expirada' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role))
      return res.status(403).json({ error: 'Sem permissão' });
    next();
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════════════════════════

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { usuario, senha } = req.body || {};
  if (!usuario || !senha) return res.status(400).json({ error: 'Preencha usuário e senha' });

  const u = db.prepare('SELECT * FROM usuarios WHERE usuario=? AND ativo=1').get(usuario);
  if (!u || !bcrypt.compareSync(senha, u.senha_hash))
    return res.status(401).json({ error: 'Usuário ou senha incorretos' });

  db.prepare("UPDATE usuarios SET ultimo_acesso=datetime('now','localtime') WHERE id=?").run(u.id);

  const payload = { id: u.id, nome: u.nome, usuario: u.usuario, cargo: u.cargo, role: u.role, setor: u.setor };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '365d' });

  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('crm_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'none',
    maxAge: 8 * 3600 * 1000,
  });

  // Notificar admins/gestores sobre novo acesso (assíncrono, não bloqueia)
  setImmediate(() => { try { notificarNovoAcesso(u.nome, u.role); } catch(e) {} });
  res.json({ ok: true, user: payload, permissoes: PERMISSOES[u.role] || [], token });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('crm_token');
  res.json({ ok: true });
});

app.get('/api/auth/me', auth, (req, res) => {
  try { db.exec("ALTER TABLE usuarios ADD COLUMN email TEXT DEFAULT ''"); } catch(e) {}
  const u = db.prepare('SELECT email FROM usuarios WHERE id=?').get(req.user.id);
  res.json({ user: { ...req.user, email: (u && u.email) || '' }, permissoes: PERMISSOES[req.user.role] || [] });
});

app.post('/api/auth/trocar-senha', auth, (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || !novaSenha) return res.status(400).json({ error: 'Campos obrigatórios' });
  if (novaSenha.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });
  const u = db.prepare('SELECT * FROM usuarios WHERE id=?').get(req.user.id);
  if (!bcrypt.compareSync(senhaAtual, u.senha_hash))
    return res.status(401).json({ error: 'Senha atual incorreta' });
  db.prepare('UPDATE usuarios SET senha_hash=? WHERE id=?').run(bcrypt.hashSync(novaSenha, 12), req.user.id);
  res.json({ ok: true });
});

// Editar próprio perfil (nome + email)
app.put('/api/auth/me', auth, (req, res) => {
  const { nome, email } = req.body;
  if (!nome || nome.trim().length < 2) return res.status(400).json({ error: 'Nome inválido' });
  // Adicionar coluna email se não existir
  try { db.exec("ALTER TABLE usuarios ADD COLUMN email TEXT DEFAULT ''"); } catch(e) {}
  db.prepare("UPDATE usuarios SET nome=?, email=? WHERE id=?").run(nome.trim(), email||'', req.user.id);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════════
// USUÁRIOS
// ════════════════════════════════════════════════════════════════════════════════

app.get('/api/usuarios', auth, (req, res) => {
  // Todos os usuários autenticados podem ver lista de usuários (para transfers, etc)
  res.json(db.prepare('SELECT id,nome,usuario,cargo,role,setor,ativo,criado_em,ultimo_acesso FROM usuarios WHERE ativo=1 ORDER BY nome').all());
});

app.post('/api/usuarios', auth, requireRole('admin','gestor'), (req, res) => {
  const { nome, usuario, senha, cargo, role, setor } = req.body;
  if (!nome || !usuario || !senha || !role) return res.status(400).json({ error: 'Campos obrigatórios' });
  if (senha.length < 6) return res.status(400).json({ error: 'Senha mínimo 6 caracteres' });
  if (db.prepare('SELECT id FROM usuarios WHERE usuario=?').get(usuario))
    return res.status(400).json({ error: 'Usuário já existe' });
  const r = db.prepare('INSERT INTO usuarios (nome,usuario,senha_hash,cargo,role,setor) VALUES (?,?,?,?,?,?)').run(
    nome, usuario, bcrypt.hashSync(senha, 12), cargo || role, role, setor || 'recepcao'
  );
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.put('/api/usuarios/:id', auth, requireRole('admin','gestor'), (req, res) => {
  const { nome, usuario, cargo, role, setor, ativo, novaSenha } = req.body;
  // Verificar unicidade do novo login se mudou
  if (usuario) {
    const existing = db.prepare('SELECT id FROM usuarios WHERE usuario=? AND id!=?').get(usuario, req.params.id);
    if (existing) return res.status(400).json({ error: 'Este login já está em uso por outro usuário' });
  }
  if (novaSenha) {
    if (novaSenha.length < 6) return res.status(400).json({ error: 'Senha mínimo 6 caracteres' });
    db.prepare('UPDATE usuarios SET senha_hash=? WHERE id=?').run(bcrypt.hashSync(novaSenha, 12), req.params.id);
  }
  db.prepare('UPDATE usuarios SET nome=COALESCE(?,nome),usuario=COALESCE(?,usuario),cargo=COALESCE(?,cargo),role=COALESCE(?,role),setor=COALESCE(?,setor),ativo=COALESCE(?,ativo) WHERE id=?')
    .run(nome||null, usuario||null, cargo||null, role||null, setor||null, ativo??null, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/usuarios/:id', auth, requireRole('admin','gestor'), (req, res) => {
  if (Number(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Não pode remover a si mesmo' });
  db.prepare('UPDATE usuarios SET ativo=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════════
// LEADS
// ════════════════════════════════════════════════════════════════════════════════

app.get('/api/leads', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM leads ORDER BY criado_em DESC').all());
});

// Rota pública para Landing Page
// ── Envio automático via Evolution API ───────────────────────────────────────
async function enviarWhatsAppAutoLead(nome, telefone, unidade) {
  try {
    const cfgRow = db.prepare("SELECT valor FROM config WHERE chave='whatsapp_auto'").get();
    if (!cfgRow) return;
    const cfg = JSON.parse(cfgRow.valor);
    if (!cfg.evolUrl || !cfg.evolKey || !cfg.evolInstance || !cfg.ativo) return;
    // Normaliza telefone: remove não-dígitos, garante DDI 55
    let num = (telefone || '').replace(/\D/g, '');
    if (!num) return;
    if (!num.startsWith('55')) num = '55' + num;
    const msgTemplate = cfg.mensagem ||
      `Olá {nome}! 👋 Recebemos seu agendamento de Exame de Vista na LS Impulsiona - {unidade}.\n\n` +
      `Em breve nossa equipe entrará em contato para confirmar seu horário. 📅\n\n` +
      `Qualquer dúvida, estamos aqui! 😊`;
    const texto = msgTemplate.replace('{nome}', nome).replace('{unidade}', unidade);
    const url = `${cfg.evolUrl.replace(/\/$/, '')}/message/sendText/${cfg.evolInstance}`;
    await fetchComTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': cfg.evolKey },
      body: JSON.stringify({ number: num, text: texto }),
    });
  } catch(e) { /* não bloqueia o lead */ }
}

app.post('/api/leads/public', async (req, res) => {
  const d = req.body;
  if (!d.nome) return res.status(400).json({ error: 'Nome obrigatório' });
  const count = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  const unidade = d.unidade || d.localidade || 'Conquista';
  let telefone = (d.telefone || '').replace(/\D/g, '');
  if (telefone && !telefone.startsWith('55')) telefone = '55' + telefone;
  const r = db.prepare('INSERT INTO leads (nome,telefone,origem,status,motivo,oculos,valor,os,unidade) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(d.nome, d.telefone||'', d.origem||'Landing Page', 'LEAD', d.motivo||'', d.oculos||'Sim', d.valor||20, String(1000+count+1), unidade);
  // Dispara WhatsApp automático (mensagem de confirmação via Evolution API)
  enviarWhatsAppAutoLead(d.nome, d.telefone||'', unidade);
  // Dispara para a IA (N8N) — se configurado, a IA vai continuar a conversa
  if (telefone) {
    setImmediate(() => dispararParaN8N('whatsapp', telefone, d.nome,
      `[NOVO LEAD] ${d.nome} se cadastrou na landing page. ` +
      `Unidade: ${unidade}. Motivo: ${d.motivo||'Exame de Vista'}. ` +
      `Telefone: ${telefone}. ` +
      `Inicie a conversa de agendamento com ele.`
    ));
  }
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.post('/api/leads', auth, (req, res) => {
  const d = req.body;
  if (!d.nome) return res.status(400).json({ error: 'Nome obrigatório' });
  const count = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  const r = db.prepare('INSERT INTO leads (nome,telefone,origem,status,motivo,oculos,valor,os) VALUES (?,?,?,?,?,?,?,?)')
    .run(d.nome, d.telefone||'', d.origem||'Manual', d.status||'LEAD', d.motivo||'', d.oculos||'Sim', d.valor||20, d.os||String(1000+count+1));
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.put('/api/leads/:id', auth, (req, res) => {
  const d = req.body;
  db.prepare("UPDATE leads SET nome=COALESCE(?,nome),telefone=COALESCE(?,telefone),status=COALESCE(?,status),origem=COALESCE(?,origem),motivo=COALESCE(?,motivo),valor=COALESCE(?,valor),atualizado_em=datetime('now','localtime') WHERE id=?")
    .run(d.nome||null, d.telefone||null, d.status||null, d.origem||null, d.motivo||null, d.valor??null, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/leads/:id', auth, requireRole('admin','gestor'), (req, res) => {
  db.prepare('DELETE FROM leads WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════════
// VENDAS
// ════════════════════════════════════════════════════════════════════════════════

app.get('/api/vendas', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM vendas ORDER BY criado_em DESC').all());
});

app.post('/api/vendas', auth, (req, res) => {
  const d = req.body;
  if (!d.valor || +d.valor <= 0) return res.status(400).json({ error: 'Valor inválido' });
  const r = db.prepare('INSERT INTO vendas (lead_id,cliente_nome,valor,pagamento,servico,tipo,tipo_cobranca,data_entrega_video,criado_por) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(d.lead_id||null, d.cliente_nome||'', +d.valor, d.pagamento||'PIX', d.servico||'', d.tipo||'Venda', d.tipo_cobranca||'Integral', d.data_entrega_video||null, req.user.id);
  if (d.tipo === 'Venda' && d.lead_id) {
    db.prepare("UPDATE leads SET status='CONVERTEU',atualizado_em=datetime('now','localtime') WHERE id=?").run(d.lead_id);
  }
  // Atualizar pontos e metas globais
  atualizarPontosEMetas(r.lastInsertRowid);
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.put('/api/vendas/:id', auth, requireRole('admin','gestor'), (req, res) => {
  const d = req.body;
  db.prepare('UPDATE vendas SET cliente_nome=COALESCE(?,cliente_nome),valor=COALESCE(?,valor),pagamento=COALESCE(?,pagamento),servico=COALESCE(?,servico),tipo=COALESCE(?,tipo) WHERE id=?')
    .run(d.cliente_nome||null, d.valor??null, d.pagamento||null, d.servico||null, d.tipo||null, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/vendas/:id', auth, requireRole('admin','gestor'), (req, res) => {
  db.prepare('DELETE FROM vendas WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════════
// AGENDAMENTOS
// ════════════════════════════════════════════════════════════════════════════════

app.get('/api/agendamentos', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM agendamentos ORDER BY data ASC, hora ASC').all());
});

app.post('/api/agendamentos', auth, (req, res) => {
  const d = req.body;
  if (!d.cliente_nome || !d.data || !d.hora) return res.status(400).json({ error: 'Campos obrigatórios' });
  const r = db.prepare('INSERT INTO agendamentos (lead_id,cliente_nome,cliente_tel,servico,data,hora,nota) VALUES (?,?,?,?,?,?,?)')
    .run(d.lead_id||null, d.cliente_nome, d.cliente_tel||'', d.servico||'', d.data, d.hora, d.nota||'');
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.put('/api/agendamentos/:id', auth, (req, res) => {
  const d = req.body;
  db.prepare('UPDATE agendamentos SET status=COALESCE(?,status),data=COALESCE(?,data),hora=COALESCE(?,hora),nota=COALESCE(?,nota) WHERE id=?')
    .run(d.status||null, d.data||null, d.hora||null, d.nota||null, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/agendamentos/:id', auth, (req, res) => {
  db.prepare('DELETE FROM agendamentos WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════════
// CHAT MSGS
// ════════════════════════════════════════════════════════════════════════════════

app.get('/api/chat/:canal', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM chat_msgs WHERE canal=? ORDER BY criado_em ASC LIMIT 200').all(req.params.canal));
});

app.post('/api/chat/:canal', auth, (req, res) => {
  const d = req.body;
  if (!d.texto) return res.status(400).json({ error: 'Texto obrigatório' });
  const r = db.prepare('INSERT INTO chat_msgs (canal,autor,setor,texto,tipo,paciente,destino,nota) VALUES (?,?,?,?,?,?,?,?)')
    .run(req.params.canal, req.user.nome, req.user.setor||'', d.texto, d.tipo||'msg', d.paciente||'', d.destino||'', d.nota||'');
  res.json({ ok: true, id: r.lastInsertRowid });
});

// ════════════════════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════════════════════

app.get('/api/config', auth, (req, res) => {
  const rows = db.prepare('SELECT chave,valor FROM config').all();
  const obj = {};
  rows.forEach(r => { try { obj[r.chave] = JSON.parse(r.valor); } catch { obj[r.chave] = r.valor; } });
  res.json(obj);
});

app.put('/api/config', auth, requireRole('admin'), (req, res) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)');
  Object.entries(req.body).forEach(([k, v]) => stmt.run(k, JSON.stringify(v)));
  res.json({ ok: true });
});

// Endpoint específico para config do WhatsApp automático (admin + gestor)
app.get('/api/config/whatsapp-auto', auth, requireRole('admin','gestor'), (req, res) => {
  const row = db.prepare("SELECT valor FROM config WHERE chave='whatsapp_auto'").get();
  if (!row) return res.json({});
  try { res.json(JSON.parse(row.valor)); } catch { res.json({}); }
});

app.put('/api/config/whatsapp-auto', auth, requireRole('admin','gestor'), (req, res) => {
  db.prepare('INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)').run('whatsapp_auto', JSON.stringify(req.body));
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════════
// WHATSAPP META — GERENCIAR CONTAS
// ════════════════════════════════════════════════════════════════════════════════

// Listar contas
app.get('/api/whatsapp/contas', auth, (req, res) => {
  try {
    const contas = db.prepare(`SELECT id,nome,phone_id,biz_id,numero,ativo,criado_em,
      CASE WHEN token IS NOT NULL AND token!='' THEN 1 ELSE 0 END as token_ok
      FROM wpp_contas ORDER BY criado_em`).all();
    res.json(contas);
  } catch(e) {
    console.error('❌ GET /api/whatsapp/contas erro:', e.message);
    res.status(500).json({ erro: e.message });
  }
});

// Adicionar/atualizar conta
app.post('/api/whatsapp/contas', auth, requireRole('admin','gestor'), (req, res) => {
  const { id, nome, token, phone_id, biz_id, numero } = req.body;
  if (!token || !phone_id) return res.status(400).json({ erro: 'Token e Phone ID obrigatórios' });
  const cid = id || ('conta-' + Date.now());
  db.prepare(`INSERT OR REPLACE INTO wpp_contas (id,nome,token,phone_id,biz_id,numero,ativo) VALUES (?,?,?,?,?,?,1)`)
    .run(cid, nome||phone_id, token, phone_id, biz_id||'', numero||'');
  // Sincronizar config principal também
  db.prepare('INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)').run('whatsapp_meta', JSON.stringify({ token, phoneId: phone_id, bizId: biz_id }));
  res.json({ ok: true, id: cid });
});

// Remover conta
app.delete('/api/whatsapp/contas/:id', auth, requireRole('admin','gestor'), (req, res) => {
  db.prepare('DELETE FROM wpp_contas WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Transferir conversa para outro usuário/setor
app.post('/api/whatsapp/transferir', auth, (req, res) => {
  const { conversa_de, para_usuario, para_nome, para_setor, motivo } = req.body;
  if (!conversa_de || !para_usuario || !para_nome) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }
  const usuarioAtual = req.user?.usuario || 'desconhecido';
  const nomeAtual = req.user?.nome || 'Desconhecido';
  const setorAtual = req.user?.setor || 'desconhecido';

  try {
    db.prepare(`INSERT INTO wpp_transferencias
      (conversa_de, de_usuario, de_nome, para_usuario, para_nome, de_setor, para_setor, motivo)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      conversa_de, usuarioAtual, nomeAtual, para_usuario, para_nome, setorAtual, para_setor, motivo
    );
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ erro: e.message });
  }
});

// Buscar histórico de transferências de uma conversa
app.get('/api/whatsapp/transferencias/:de', auth, (req, res) => {
  const transfers = db.prepare(`
    SELECT * FROM wpp_transferencias
    WHERE conversa_de=?
    ORDER BY criado_em DESC
  `).all(req.params.de);
  res.json(transfers || []);
});

// Buscar token de uma conta pelo phone_id (usado pelo webhook)
function getTokenPorPhoneId(phoneId) {
  const conta = db.prepare('SELECT token FROM wpp_contas WHERE phone_id=? AND ativo=1').get(phoneId);
  if (conta?.token) return conta.token;
  // fallback: config global
  try {
    const cfg = db.prepare("SELECT valor FROM config WHERE chave='whatsapp_meta'").get();
    return cfg ? JSON.parse(cfg.valor).token : null;
  } catch(e) { return null; }
}

// ════════════════════════════════════════════════════════════════════════════════
// WHATSAPP META CLOUD API — WEBHOOK
// ════════════════════════════════════════════════════════════════════════════════

const WPP_VERIFY_TOKEN = process.env.WPP_VERIFY_TOKEN || 'alliance_wpp_2024';

// Verificação do webhook pela Meta (GET)
app.get('/api/whatsapp/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === WPP_VERIFY_TOKEN) {
    console.log('✅ Webhook WhatsApp verificado pela Meta');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Receber mensagens da Meta (POST)
app.post('/api/whatsapp/webhook', (req, res) => {
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return res.sendStatus(200);
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    if (!value?.messages) return res.sendStatus(200);

    value.messages.forEach(msg => {
      const de    = msg.from;
      const wamid = msg.id;
      const tipo  = msg.type || 'text';
      const texto = tipo === 'text' ? msg.text?.body :
                    tipo === 'image' ? '[Imagem]' :
                    tipo === 'audio' ? '[Áudio]' :
                    tipo === 'document' ? '[Documento]' :
                    tipo === 'video' ? '[Vídeo]' : '[Mensagem]';

      // Pega nome do contato se disponível
      const contatos = value.contacts || [];
      const contato  = contatos.find(c => c.wa_id === de);
      const nome     = contato?.profile?.name || de;

      // Converte timestamp Meta (Unix/UTC) para horário de Brasília (UTC-3)
      const tsMeta   = msg.timestamp ? parseInt(msg.timestamp) : Math.floor(Date.now()/1000);
      const dtBrasil = new Date((tsMeta * 1000) - (3 * 60 * 60 * 1000));
      const Y = dtBrasil.getUTCFullYear(), M = String(dtBrasil.getUTCMonth()+1).padStart(2,'0'), D = String(dtBrasil.getUTCDate()).padStart(2,'0');
      const H = String(dtBrasil.getUTCHours()).padStart(2,'0'), Mi = String(dtBrasil.getUTCMinutes()).padStart(2,'0'), S = String(dtBrasil.getUTCSeconds()).padStart(2,'0');
      const criadoEm = `${Y}-${M}-${D} ${H}:${Mi}:${S}`;

      try {
        db.prepare(`INSERT OR IGNORE INTO wpp_mensagens (wamid, de, nome, texto, tipo, direcao, criado_em)
                    VALUES (?,?,?,?,?,'recebida',?)`).run(wamid, de, nome, texto, tipo, criadoEm);
        // Disparar para N8N automaticamente
        setImmediate(() => dispararParaN8N('whatsapp', de, nome, texto));
      } catch(e) { console.error('Erro ao salvar msg wpp:', e.message); }
    });
  } catch(e) { console.error('Erro webhook wpp:', e.message); }
  res.sendStatus(200);
});

// ════════════════════════════════════════════════════════════════════════════════
// INSTAGRAM WEBHOOK
// ════════════════════════════════════════════════════════════════════════════════

const INSTAGRAM_VERIFY_TOKEN = 'alliance_instagram_2024';

// Verificar webhook Instagram (GET)
app.get('/api/instagram/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === INSTAGRAM_VERIFY_TOKEN) {
    console.log('✅ Webhook Instagram verificado pela Meta');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Receber mensagens do Instagram (POST)
app.post('/api/instagram/webhook', (req, res) => {
  try {
    const body = req.body;
    if (body.object !== 'instagram') {
      return res.sendStatus(200);
    }

    const entry = body.entry?.[0];
    if (!entry) {
      return res.sendStatus(200);
    }

    const messaging = entry?.messaging || [];

    messaging.forEach((msg, idx) => {
      if (!msg.message) {
        return;
      }

      const de       = msg.sender?.id;  // Instagram user ID
      const igid     = msg.message?.mid; // Message ID
      // Usar username se disponível (mais amigável que o ID numérico)
      const username = msg.sender?.username || null;
      const nome     = msg.sender?.name || (username ? `@${username}` : `Cliente Instagram`);

      // Detectar tipo e texto da mensagem corretamente
      let tipo = 'text';
      let texto = '';
      if (msg.message?.text) {
        texto = msg.message.text;
        tipo = 'text';
      } else if (msg.message?.attachments) {
        const att = msg.message.attachments[0];
        if (att?.type === 'image') { tipo = 'image'; texto = '📷 Imagem'; }
        else if (att?.type === 'video') { tipo = 'video'; texto = '🎥 Vídeo'; }
        else if (att?.type === 'audio') { tipo = 'audio'; texto = '🎵 Áudio'; }
        else if (att?.type === 'file') { tipo = 'file'; texto = '📎 Arquivo'; }
        else if (att?.type === 'ig_reel') { tipo = 'video'; texto = '🎥 Reel compartilhado'; }
        else { tipo = 'media'; texto = '📎 Mídia'; }
      } else if (msg.message?.sticker_id) {
        tipo = 'sticker'; texto = '🎭 Figurinha';
      } else if (msg.message?.reply_to) {
        texto = msg.message?.text || '↩️ Resposta a mensagem';
      } else {
        texto = '[Mensagem]';
      }

      if (!de || !igid) {
        return;
      }

      // Timestamp — Instagram envia em ms (ex: 1774551930570), WhatsApp em segundos
      const tsMeta = msg.timestamp ? parseInt(msg.timestamp) : Date.now();
      const tsMs   = tsMeta < 1e12 ? tsMeta * 1000 : tsMeta; // converte só se for segundos
      const dtBrasil = new Date(tsMs - (3 * 60 * 60 * 1000));
      const Y = dtBrasil.getUTCFullYear(), M = String(dtBrasil.getUTCMonth()+1).padStart(2,'0'), D = String(dtBrasil.getUTCDate()).padStart(2,'0');
      const H = String(dtBrasil.getUTCHours()).padStart(2,'0'), Mi = String(dtBrasil.getUTCMinutes()).padStart(2,'0'), S = String(dtBrasil.getUTCSeconds()).padStart(2,'0');
      const criadoEm = `${Y}-${M}-${D} ${H}:${Mi}:${S}`;

      try {
        db.prepare(`INSERT OR IGNORE INTO instagram_mensagens (igid, de, nome, username, texto, tipo, direcao, criado_em)
                    VALUES (?,?,?,?,?,?,'recebida',?)`).run(igid, de, nome, username, texto, tipo, criadoEm);

        // Disparar para N8N automaticamente (assíncrono, não bloqueia)
        setImmediate(() => dispararParaN8N('instagram', de, nome, texto));

        // Buscar nome e foto real do usuário Instagram via API (assincrono)
        setImmediate(async () => {
          try {
            const cfg = db.prepare("SELECT valor FROM config WHERE chave='instagram_meta'").get();
            if (!cfg) return;
            const igCfg = JSON.parse(cfg.valor);
            if (!igCfg.token) return;

            // Buscar perfil do remetente via API de conversas
            const businessId = igCfg.business_id || '17841448115950083';
            const convUrl = `https://graph.instagram.com/v20.0/${businessId}/conversations?user_id=${de}&fields=participants&access_token=${igCfg.token}`;
            const rConv = await fetchComTimeout(convUrl);
            const convData = await rConv.json();

            // Extrair nome/username dos participantes
            let nomeReal = nome, usernameReal = username, foto = null;
            const participantes = convData?.data?.[0]?.participants?.data || [];
            const remetente = participantes.find(p => p.id === de) || participantes.find(p => p.id !== businessId);
            if (remetente) {
              nomeReal = remetente.name || remetente.username || nome;
              usernameReal = remetente.username || username;
              foto = remetente.profile_pic_uri || remetente.pic || null;
            }

            // Se ainda for "Usuario X", tentar buscar direto pelo ID
            if (!remetente || nomeReal.startsWith('Usuario ')) {
              const rDirect = await fetchComTimeout(`https://graph.instagram.com/v20.0/${de}?fields=name,username,profile_picture_url&access_token=${igCfg.token}`);
              const pDirect = await rDirect.json();
              if (pDirect.name || pDirect.username) {
                nomeReal = pDirect.name || pDirect.username || nomeReal;
                usernameReal = pDirect.username || usernameReal;
                foto = pDirect.profile_picture_url || foto;
              }
            }

            // Atualizar banco
            db.prepare(`UPDATE instagram_mensagens SET nome=?, username=? WHERE de=? AND direcao='recebida'`)
              .run(nomeReal, usernameReal, de);
            try { db.exec(`ALTER TABLE instagram_mensagens ADD COLUMN foto_url TEXT`); } catch(e) {}
            if (foto) {
              db.prepare(`UPDATE instagram_mensagens SET foto_url=? WHERE de=?`).run(foto, de);
            }
          } catch(e) {
            // Silencioso — não bloqueia o processamento principal
          }
        });
      } catch(e) { console.error(`  ❌ [${idx}] Erro ao salvar:`, e.message); }
    });
  } catch(e) { console.error('❌ Erro webhook instagram:', e.message); }
  res.sendStatus(200);
});

// Buscar conversas (lista de contatos)
app.get('/api/whatsapp/conversas', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT de,
           -- Pega o nome do contact de uma mensagem recebida (direcao='recebida')
           (SELECT nome FROM wpp_mensagens m2 WHERE m2.de=m.de AND m2.direcao='recebida' LIMIT 1) as nome,
           MAX(criado_em) as ultima,
           COUNT(*) as total,
           SUM(CASE WHEN lido=0 AND direcao='recebida' THEN 1 ELSE 0 END) as nao_lidas,
           (SELECT texto FROM wpp_mensagens m2 WHERE m2.de=m.de ORDER BY m2.criado_em DESC LIMIT 1) as ultima_msg
    FROM wpp_mensagens m
    GROUP BY de
    ORDER BY ultima DESC
  `).all();
  res.json(rows);
});

// Buscar mensagens de um contato
app.get('/api/whatsapp/mensagens/:de', auth, (req, res) => {
  const msgs = db.prepare(`
    SELECT * FROM wpp_mensagens WHERE de=? ORDER BY criado_em ASC
  `).all(req.params.de);
  // Marcar como lido
  db.prepare(`UPDATE wpp_mensagens SET lido=1 WHERE de=? AND direcao='recebida'`).run(req.params.de);
  res.json(msgs);
});

// Enviar mensagem via Meta Cloud API
app.post('/api/whatsapp/enviar', auth, async (req, res) => {
  const { para, texto, contaId } = req.body;
  // Busca a conta correta (por contaId ou a primeira ativa)
  let conta = contaId
    ? db.prepare('SELECT * FROM wpp_contas WHERE id=? AND ativo=1').get(contaId)
    : db.prepare('SELECT * FROM wpp_contas WHERE ativo=1 ORDER BY criado_em LIMIT 1').get();
  // Fallback para config global
  if (!conta?.token) {
    const cfg = db.prepare("SELECT valor FROM config WHERE chave='whatsapp_meta'").get();
    if (!cfg) return res.status(400).json({ erro: 'Nenhuma conta WhatsApp configurada' });
    const c = JSON.parse(cfg.valor);
    conta = { token: c.token, phone_id: c.phoneId };
  }
  const { token, phone_id: phoneId } = conta;
  if (!token || !phoneId) return res.status(400).json({ erro: 'Token ou Phone ID faltando' });

  // Incluir nome do sender na mensagem
  const nomeSender = req.user?.nome || 'Atendente';
  const textoComNome = `${nomeSender}: ${texto}`;

  try {
    const r = await fetchComTimeout(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: para.replace(/\D/g, ''),
        type: 'text',
        text: { body: textoComNome }
      })
    });
    const data = await r.json();
    if (data.messages?.[0]?.id) {
      // Gera timestamp em horário de Brasília (UTC-3)
      const dtBrasil = new Date(Date.now() - (3 * 60 * 60 * 1000));
      const Y = dtBrasil.getUTCFullYear(), M = String(dtBrasil.getUTCMonth()+1).padStart(2,'0'), D = String(dtBrasil.getUTCDate()).padStart(2,'0');
      const H = String(dtBrasil.getUTCHours()).padStart(2,'0'), Mi = String(dtBrasil.getUTCMinutes()).padStart(2,'0'), S = String(dtBrasil.getUTCSeconds()).padStart(2,'0');
      const criadoEm = `${Y}-${M}-${D} ${H}:${Mi}:${S}`;
      // Armazenar também com o nome do sender (não apenas "Você")
      db.prepare(`INSERT INTO wpp_mensagens (wamid, de, nome, texto, tipo, direcao, criado_em)
                  VALUES (?,?,?,?,'text','enviada',?)`).run(
        data.messages[0].id, para.replace(/\D/g, ''), nomeSender, texto, criadoEm
      );
      res.json({ ok: true });
    } else {
      res.status(400).json({ erro: data.error?.message || 'Erro ao enviar' });
    }
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// Salvar config da Meta API — WHATSAPP APENAS
app.put('/api/config/whatsapp-meta', auth, requireRole('admin','gestor'), (req, res) => {
  // Salvar APENAS config WhatsApp (sem auto-config do Instagram)
  db.prepare('INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)').run('whatsapp_meta', JSON.stringify(req.body));
  res.json({ ok: true });
});

// Salvar config da Meta API — INSTAGRAM APENAS
app.put('/api/config/instagram-meta', auth, requireRole('admin','gestor'), (req, res) => {
  // Salvar APENAS config Instagram
  const { token, business_id } = req.body;
  if (!token || !business_id) return res.status(400).json({ erro: 'Token e Business ID obrigatórios' });

  const instagramConfig = { token, business_id };
  db.prepare('INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)').run('instagram_meta', JSON.stringify(instagramConfig));
  res.json({ ok: true });
});

// Carregar config Instagram
app.get('/api/config/instagram-meta', auth, requireRole('admin','gestor'), (req, res) => {
  const row = db.prepare("SELECT valor FROM config WHERE chave='instagram_meta'").get();
  if (!row) return res.json({});
  try { res.json(JSON.parse(row.valor)); } catch { res.json({}); }
});

app.get('/api/config/whatsapp-meta', auth, requireRole('admin','gestor'), (req, res) => {
  const row = db.prepare("SELECT valor FROM config WHERE chave='whatsapp_meta'").get();
  if (!row) return res.json({});
  try { res.json(JSON.parse(row.valor)); } catch { res.json({}); }
});

// ════════════════════════════════════════════════════════════════════════════════
// INSTAGRAM — ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════════

// Buscar conversas Instagram
app.get('/api/instagram/conversas', auth, (req, res) => {
  try {
    // Garantir coluna foto_url existe
    try { db.exec(`ALTER TABLE instagram_mensagens ADD COLUMN foto_url TEXT`); } catch(e) {}

    const rows = db.prepare(`
      SELECT de,
             (SELECT nome FROM instagram_mensagens m2 WHERE m2.de=m.de AND m2.direcao='recebida' LIMIT 1) as nome,
             (SELECT username FROM instagram_mensagens m2 WHERE m2.de=m.de AND m2.direcao='recebida' LIMIT 1) as username,
             (SELECT foto_url FROM instagram_mensagens m2 WHERE m2.de=m.de AND m2.direcao='recebida' AND foto_url IS NOT NULL LIMIT 1) as foto_url,
             MAX(criado_em) as ultima,
             COUNT(*) as total,
             SUM(CASE WHEN lido=0 AND direcao='recebida' THEN 1 ELSE 0 END) as nao_lidas,
             (SELECT texto FROM instagram_mensagens m2 WHERE m2.de=m.de ORDER BY m2.criado_em DESC LIMIT 1) as ultima_msg
      FROM instagram_mensagens m
      GROUP BY de
      ORDER BY ultima DESC
    `).all();
    res.json(rows);
  } catch(e) {
    console.error('📸 Erro ao buscar conversas Instagram:', e.message);
    res.status(500).json({ erro: e.message });
  }
});

// Buscar mensagens de um usuário Instagram
app.get('/api/instagram/mensagens/:de', auth, (req, res) => {
  const msgs = db.prepare(`
    SELECT * FROM instagram_mensagens WHERE de=? ORDER BY criado_em ASC
  `).all(req.params.de);
  // Marcar como lido
  db.prepare(`UPDATE instagram_mensagens SET lido=1 WHERE de=? AND direcao='recebida'`).run(req.params.de);
  res.json(msgs);
});

// Enviar mensagem Instagram
app.post('/api/instagram/enviar', auth, async (req, res) => {
  try {
    const { para, texto } = req.body;

    if (!para || !texto) {
      return res.status(400).json({ erro: 'Para e texto obrigatórios' });
    }

    // Buscar token — opcional, sem config ainda funciona (salva local)
    let token = null, business_id = null;
    try {
      const cfg = db.prepare("SELECT valor FROM config WHERE chave='instagram_meta'").get();
      if (cfg) {
        const c = JSON.parse(cfg.valor);
        token = c.token || null;
        business_id = c.business_id || null;
      }
    } catch(e) {}

    const nomeSender = req.user?.nome || 'Atendente';
    const textoComNome = `${nomeSender}: ${texto}`;

    // Armazenar na base PRIMEIRO (para funcionar mesmo se API falhar)
    const dtBrasil = new Date(Date.now() - (3 * 60 * 60 * 1000));
    const Y = dtBrasil.getUTCFullYear(), M = String(dtBrasil.getUTCMonth()+1).padStart(2,'0'), D = String(dtBrasil.getUTCDate()).padStart(2,'0');
    const H = String(dtBrasil.getUTCHours()).padStart(2,'0'), Mi = String(dtBrasil.getUTCMinutes()).padStart(2,'0'), S = String(dtBrasil.getUTCSeconds()).padStart(2,'0');
    const criadoEm = `${Y}-${M}-${D} ${H}:${Mi}:${S}`;

    const msgId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    db.prepare(`INSERT INTO instagram_mensagens (igid, de, nome, texto, tipo, direcao, criado_em)
                VALUES (?,?,?,?,'text','enviada',?)`).run(
      msgId, para, nomeSender, texto, criadoEm
    );

    // Tentar enviar via Graph API Instagram (assincrono, não bloqueia)
    if (token && business_id) {
      setImmediate(async () => {
        try {
          const url = `https://graph.instagram.com/v20.0/${business_id}/messages`;
          const r = await fetchComTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ recipient: { id: para }, message: { text: textoComNome } })
          });
          const data = await r.json();
          if (data.message_id) {
            db.prepare(`UPDATE instagram_mensagens SET igid=? WHERE igid=?`).run(data.message_id, msgId);
          }
        } catch(e) {
          // Silencioso — mensagem já foi salva localmente
        }
      });
    }

    // Responder imediatamente COM SUCESSO
    res.json({ ok: true });

  } catch(e) {
    console.error(`❌ Erro ao enviar mensagem Instagram:`, e.message);
    res.status(500).json({ erro: e.message });
  }
});

// ═══════════════════════════════════════════════════════════
// INTEGRAÇÃO N8N / IA
// ═══════════════════════════════════════════════════════════

// Salvar/buscar config N8N
app.put('/api/config/n8n', auth, requireRole('admin','gestor'), (req, res) => {
  const atual = db.prepare("SELECT valor FROM config WHERE chave='n8n_config'").get();
  const base = atual ? JSON.parse(atual.valor) : {};
  const novo = { ...base, ...req.body };
  db.prepare('INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)').run('n8n_config', JSON.stringify(novo));
  // Também atualiza token da IA separado para compatibilidade
  if(req.body.token) db.prepare('INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)').run('n8n_token', JSON.stringify(req.body.token));
  res.json({ ok: true });
});

app.get('/api/config/n8n', auth, requireRole('admin','gestor'), (req, res) => {
  const cfg = db.prepare("SELECT valor FROM config WHERE chave='n8n_config'").get();
  res.json(cfg ? JSON.parse(cfg.valor) : {});
});

// Função para disparar mensagem para o N8N automaticamente
async function dispararParaN8N(canal, de, nome, texto) {
  try {
    const cfgN8N = db.prepare("SELECT valor FROM config WHERE chave='n8n_config'").get();
    if (!cfgN8N) return;
    const n8n = JSON.parse(cfgN8N.valor);
    if (!n8n.webhook_url) return;

    const cfgToken = db.prepare("SELECT valor FROM config WHERE chave='n8n_token'").get();
    const tokenIa = cfgToken ? JSON.parse(cfgToken.valor) : 'alliance_ia_2024';

    const payload = { canal, de, nome, texto, timestamp: new Date().toISOString(), token_ia: tokenIa };
    fetchComTimeout(n8n.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(e => console.warn(`⚠️ Falha ao disparar N8N:`, e.message));
  } catch(e) {
    console.warn('⚠️ Erro ao disparar N8N:', e.message);
  }
}

// Endpoint que o N8N chama para enviar resposta automática
// POST /api/ia/resposta
// Body: { canal: 'whatsapp'|'instagram', para: '5571...', texto: '...' }
app.post('/api/ia/resposta', iaLimiter, async (req, res) => {
  try {
    const { canal, para, texto, token_ia } = req.body;

    // Validar token da IA (segurança básica)
    const cfgIa = db.prepare("SELECT valor FROM config WHERE chave='n8n_token'").get();
    const tokenEsperado = cfgIa ? JSON.parse(cfgIa.valor) : process.env.N8N_TOKEN || 'alliance_ia_2024';
    if (token_ia !== tokenEsperado) {
      return res.status(401).json({ erro: 'Token IA inválido' });
    }

    if (!para || !texto) return res.status(400).json({ erro: 'para e texto obrigatórios' });

    // Validar campo 'para' — aceita apenas dígitos (telefone) ou ID numérico Instagram
    if (!/^\d{7,20}$/.test(String(para).replace(/\D/g, ''))) {
      return res.status(400).json({ erro: 'Campo para inválido' });
    }

    if (canal === 'instagram') {
      // Enviar via Instagram
      const cfg = db.prepare("SELECT valor FROM config WHERE chave='instagram_meta'").get();
      if (!cfg) return res.status(400).json({ erro: 'Instagram não configurado' });
      const { token, business_id } = JSON.parse(cfg.valor);

      const dtBrasil = new Date(Date.now() - (3 * 60 * 60 * 1000));
      const criadoEm = dtBrasil.toISOString().slice(0,19).replace('T',' ');

      // Salvar no banco
      const msgId = `ia_${Date.now()}`;
      db.prepare(`INSERT INTO instagram_mensagens (igid,de,nome,texto,tipo,direcao,criado_em) VALUES (?,?,?,?,'text','enviada',?)`)
        .run(msgId, para, 'IA Alliance', texto, criadoEm);

      // Enviar via API Instagram
      const r = await fetchComTimeout(`https://graph.instagram.com/v20.0/${business_id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ recipient: { id: para }, message: { text: texto } })
      });
      const data = await r.json();
      res.json({ ok: true, data });

    } else {
      // Enviar via WhatsApp
      const conta = db.prepare('SELECT * FROM wpp_contas WHERE ativo=1 ORDER BY criado_em LIMIT 1').get();
      if (!conta) return res.status(400).json({ erro: 'WhatsApp não configurado' });

      const dtBrasil = new Date(Date.now() - (3 * 60 * 60 * 1000));
      const criadoEm = dtBrasil.toISOString().slice(0,19).replace('T',' ');

      // Salvar no banco
      const wamid = `ia_wpp_${Date.now()}`;
      db.prepare(`INSERT INTO wpp_mensagens (wamid,de,nome,texto,tipo,direcao,criado_em) VALUES (?,?,?,?,'text','enviada',?)`)
        .run(wamid, para, 'IA Alliance', texto, criadoEm);

      // Enviar via API WhatsApp (phone_id é o campo correto no schema wpp_contas)
      const r = await fetchComTimeout(`https://graph.facebook.com/v20.0/${conta.phone_id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + conta.token },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto } })
      });
      const data = await r.json();
      res.json({ ok: true, data });
    }
  } catch(e) {
    console.error('❌ Erro IA resposta:', e.message);
    res.status(500).json({ erro: e.message });
  }
});

// Endpoint para configurar token do N8N
app.put('/api/config/n8n-token', auth, requireRole('admin','gestor'), (req, res) => {
  const { token } = req.body;
  db.prepare('INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)').run('n8n_token', JSON.stringify(token));
  res.json({ ok: true });
});

// Transferir conversa Instagram
app.post('/api/instagram/transferir', auth, (req, res) => {
  const { conversa_de, para_usuario, para_nome, para_setor, motivo } = req.body;
  if (!conversa_de || !para_usuario || !para_nome) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }
  const usuarioAtual = req.user?.usuario || 'desconhecido';
  const nomeAtual = req.user?.nome || 'Desconhecido';
  const setorAtual = req.user?.setor || 'desconhecido';

  try {
    db.prepare(`INSERT INTO instagram_transferencias
      (conversa_de, de_usuario, de_nome, para_usuario, para_nome, de_setor, para_setor, motivo)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      conversa_de, usuarioAtual, nomeAtual, para_usuario, para_nome, setorAtual, para_setor, motivo
    );
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ erro: e.message });
  }
});

// Buscar transferências Instagram
app.get('/api/instagram/transferencias/:de', auth, (req, res) => {
  const transfers = db.prepare(`
    SELECT * FROM instagram_transferencias
    WHERE conversa_de=?
    ORDER BY criado_em DESC
  `).all(req.params.de);
  res.json(transfers || []);
});

// Sincronizar histórico de conversas da Meta API
app.post('/api/whatsapp/sincronizar-historico', auth, requireRole('admin','gestor'), async (req, res) => {
  try {
    let { token, phoneId, bizId } = req.body;
    // Fallback: pega do banco se não veio no body
    if (!token || !phoneId) {
      const cfg = db.prepare("SELECT valor FROM config WHERE chave='whatsapp_meta'").get();
      if (cfg) { const c = JSON.parse(cfg.valor); token=c.token; phoneId=c.phoneId; bizId=c.bizId; }
    }
    if (!token || !phoneId) return res.status(400).json({ erro: 'Token ou Phone ID não configurado. Salve as credenciais na aba WhatsApp primeiro.' });

    // Salva token no banco para uso futuro (webhook, envio)
    db.prepare('INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)').run('whatsapp_meta', JSON.stringify({ token, phoneId, bizId }));

    let count = 0;

    // Tenta buscar via WABA (Business Account)
    if (bizId) {
      const url = `https://graph.facebook.com/v20.0/${bizId}/conversations?fields=id,messages{from,timestamp,type,text}&limit=50`;
      const r = await fetchComTimeout(url, { headers: { Authorization: 'Bearer ' + token } });
      const data = await r.json();
      if (!data.error) {
        for (const conv of (data.data||[])) {
          for (const msg of (conv.messages?.data||[])) {
            const de    = msg.from?.phone || msg.from?.id || 'desconhecido';
            const nome  = msg.from?.name || de;
            const texto = msg.text?.body || `[${msg.type||'mensagem'}]`;
            const ts    = new Date((msg.timestamp||Date.now()/1000)*1000).toISOString().replace('T',' ').slice(0,19);
            try { db.prepare(`INSERT OR IGNORE INTO wpp_mensagens (wamid,de,nome,texto,tipo,direcao,criado_em) VALUES (?,?,?,?,'text','recebida',?)`).run(msg.id,de,nome,texto,ts); count++; } catch(e){}
          }
        }
      } else {
        console.log('Meta WABA conversations error:', data.error.message);
      }
    }

    res.json({ ok: true, mensagens: count, info: count===0 ? 'A API Meta só entrega mensagens novas via webhook. Envie uma mensagem para o número e ela aparecerá automaticamente.' : null });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// Corrigir timestamps de mensagens antigas (fix one-time para mensagens com timestamp errado)
app.post('/api/whatsapp/corrigir-timestamps', auth, requireRole('admin'), (req, res) => {
  try {
    // Mensagens enviadas têm timestamp 3h a mais (UTC em vez de UTC-3)
    // Corrige subtraindo 3 horas das mensagens "enviadas" com criado_em >= 18:00
    const rows = db.prepare(`
      SELECT id, criado_em FROM wpp_mensagens
      WHERE direcao='enviada' AND (criado_em LIKE '%18:%' OR criado_em LIKE '%19:%' OR criado_em LIKE '%20:%' OR criado_em LIKE '%21:%' OR criado_em LIKE '%22:%' OR criado_em LIKE '%23:%')
    `).all();

    let fixed = 0;
    rows.forEach(row => {
      try {
        const dt = new Date(row.criado_em);
        const dtCorrigido = new Date(dt.getTime() - (3 * 60 * 60 * 1000));
        const Y = dtCorrigido.getUTCFullYear(), M = String(dtCorrigido.getUTCMonth()+1).padStart(2,'0'), D = String(dtCorrigido.getUTCDate()).padStart(2,'0');
        const H = String(dtCorrigido.getUTCHours()).padStart(2,'0'), Mi = String(dtCorrigido.getUTCMinutes()).padStart(2,'0'), S = String(dtCorrigido.getUTCSeconds()).padStart(2,'0');
        const novoTs = `${Y}-${M}-${D} ${H}:${Mi}:${S}`;
        db.prepare('UPDATE wpp_mensagens SET criado_em=? WHERE id=?').run(novoTs, row.id);
        fixed++;
      } catch(e) {}
    });

    res.json({ ok: true, corrigidas: fixed });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({ ok: true, version: '2.0.0', empresa: 'LS Impulsiona', uptime: process.uptime() });
});

// ════════════════════════════════════════════════════════════════════════════════
// ESTATÍSTICAS RÁPIDAS (sem auth — para dashboard público)
// ════════════════════════════════════════════════════════════════════════════════
app.get('/api/stats', auth, (req, res) => {
  const total   = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  const hoje    = db.prepare("SELECT COUNT(*) as c FROM leads WHERE date(criado_em)=date('now','localtime')").get().c;
  const conv    = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='CONVERTEU'").get().c;
  const agendHj = db.prepare("SELECT COUNT(*) as c FROM agendamentos WHERE data=date('now','localtime') AND status='scheduled'").get().c;
  const fat     = db.prepare("SELECT COALESCE(SUM(valor),0) as v FROM vendas WHERE tipo='Venda' AND date(criado_em)>=date('now','start of month')").get().v;
  res.json({ total, hoje, conv, agendHj, fatMes: fat, taxa: total>0?Math.round(conv/total*100):0 });
});

// ════════════════════════════════════════════════════════════════════════════════
// STATIC — serve o CRM
// ════════════════════════════════════════════════════════════════════════════════

// HTML nunca cacheado — JS/CSS cacheados por 1h
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html') || req.path.endsWith('sw.js')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true,
}));

// Rota explícita para a Landing Page (garante servir mesmo sem cache Docker)
let _lpCache = null;
app.get(['/lp', '/lp.html'], async (req, res) => {
  const lpPath = path.join(__dirname, 'public', 'lp.html');
  if (fs.existsSync(lpPath)) return res.sendFile(lpPath);
  try {
    if (!_lpCache) {
      const r = await fetchComTimeout('https://raw.githubusercontent.com/larysoares004-afk/ls-impulsiona-crm/main/public/lp.html');
      _lpCache = await r.text();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(_lpCache);
  } catch(e) {
    res.status(503).send('Landing page temporariamente indisponível');
  }
});

// Rota explícita para página de instalação do app (com fallback GitHub)
let _instalarCache = null;
app.get(['/instalar', '/instalar.html', '/baixar', '/app', '/download'], async (req, res) => {
  const p = path.join(__dirname, 'public', 'instalar.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  try {
    if (!_instalarCache) {
      const r = await fetchComTimeout('https://raw.githubusercontent.com/larysoares004-afk/ls-impulsiona-crm/main/public/instalar.html');
      _instalarCache = await r.text();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(_instalarCache);
  } catch(e) {
    res.status(503).send('Página de instalação temporariamente indisponível');
  }
});

// catch-all movido para o final — NÃO remover daqui

// ════════════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════════

// Tabela de subscriptions
try {
  db.exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    endpoint   TEXT NOT NULL UNIQUE,
    keys_auth  TEXT NOT NULL,
    keys_p256dh TEXT NOT NULL,
    criado_em  TEXT DEFAULT (datetime('now','localtime'))
  )`);
} catch(e) {}

// Chave pública VAPID para o cliente
app.get('/api/push/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

// Salvar subscription
app.post('/api/push/subscribe', auth, (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys) return res.status(400).json({ error: 'Dados inválidos' });
  try {
    db.prepare(`INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, keys_auth, keys_p256dh)
      VALUES (?, ?, ?, ?)`).run(req.user.id, endpoint, keys.auth, keys.p256dh);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Remover subscription
app.post('/api/push/unsubscribe', auth, (req, res) => {
  const { endpoint } = req.body;
  db.prepare('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?').run(req.user.id, endpoint);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════════
// DASHBOARD v2 - NOVAS FUNCIONALIDADES
// ════════════════════════════════════════════════════════════════════════════════

// Função para calcular pontos baseado em valor da venda
function calcularPontos(valor) {
  if (valor < 400) return 1;
  if (valor < 601) return 3;
  if (valor < 801) return 4;
  if (valor < 1001) return 5;
  if (valor < 1501) return 6;
  return 7;
}

function getFaixaValor(valor) {
  if (valor < 400) return '1-399';
  if (valor < 601) return '400-600';
  if (valor < 801) return '601-800';
  if (valor < 1001) return '801-1000';
  if (valor < 1501) return '1001-1500';
  return '1501+';
}

// GET /api/dashboard/resumo - Resumo geral com metas e KPIs
app.get('/api/dashboard/resumo', auth, (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const dataInicio7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const mesAtual = hoje.substring(0, 7);

    // Metas
    const metaDia = db.prepare('SELECT valor_meta, valor_realizado FROM metas_globais WHERE periodo="diaria" AND mes_ano=?').get(hoje) || { valor_meta: 5000, valor_realizado: 0 };
    const metaSemana = db.prepare('SELECT valor_meta, valor_realizado FROM metas_globais WHERE periodo="semanal" AND mes_ano>=?').get(dataInicio7) || { valor_meta: 35000, valor_realizado: 0 };
    const metaMes = db.prepare('SELECT valor_meta, valor_realizado FROM metas_globais WHERE periodo="mensal" AND mes_ano=?').get(mesAtual + '-01') || { valor_meta: 150000, valor_realizado: 0 };

    // Conversões
    const conversoes = db.prepare('SELECT COUNT(*) as c FROM vendas WHERE date(criado_em)=?').get(hoje);
    const leads = db.prepare('SELECT COUNT(*) as c FROM leads WHERE date(criado_em)=?').get(hoje);
    const taxaConversao = leads?.c > 0 ? Math.round((conversoes?.c || 0) / leads.c * 100) : 0;

    // Ticket médio
    const ticketMedio = db.prepare('SELECT AVG(valor) as media FROM vendas WHERE date(criado_em)>=?').get(dataInicio7);

    // Leads pendentes (não convertidos)
    const leadsPendentes = db.prepare('SELECT COUNT(*) as c FROM leads WHERE status != "CONVERTEU"').get();

    res.json({
      meta_dia: { valor: metaDia.valor_meta, realizado: metaDia.valor_realizado, pct: Math.round((metaDia.valor_realizado / metaDia.valor_meta) * 100) },
      meta_semana: { valor: metaSemana.valor_meta, realizado: metaSemana.valor_realizado, pct: Math.round((metaSemana.valor_realizado / metaSemana.valor_meta) * 100) },
      meta_mes: { valor: metaMes.valor_meta, realizado: metaMes.valor_realizado, pct: Math.round((metaMes.valor_realizado / metaMes.valor_meta) * 100) },
      conversoes_hoje: conversoes?.c || 0,
      taxa_conversao: taxaConversao,
      ticket_medio: Math.round(ticketMedio?.media || 0),
      leads_pendentes: leadsPendentes?.c || 0
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dashboard/ranking-atendentes - TOP 10 atendentes por pontos
app.get('/api/dashboard/ranking-atendentes', auth, (req, res) => {
  try {
    const periodo = req.query.periodo || 'mes'; // dia, semana, mes, tudo
    let where = '1=1';
    const hoje = new Date();

    if (periodo === 'dia') {
      const data = hoje.toISOString().split('T')[0];
      where = `pa.data='${data}'`;
    } else if (periodo === 'semana') {
      const data7 = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      where = `pa.data>='${data7}'`;
    } else if (periodo === 'mes') {
      const mesPrimeiro = hoje.toISOString().split('T')[0].substring(0, 7) + '-01';
      where = `pa.data>='${mesPrimeiro}'`;
    }

    const ranking = db.prepare(`
      SELECT
        u.id, u.nome,
        COALESCE(SUM(pa.pontos), 0) as pontos,
        COUNT(DISTINCT pa.venda_id) as vendas,
        COALESCE(SUM(v.valor), 0) as valor_total
      FROM usuarios u
      LEFT JOIN pontuacao_atendentes pa ON u.id=pa.usuario_id AND ${where}
      LEFT JOIN vendas v ON u.id=v.criado_por AND ${where.replace('pa.', 'date(v.criado_em)=')}
      WHERE u.ativo=1
      GROUP BY u.id
      ORDER BY pontos DESC
      LIMIT 10
    `).all();

    res.json(ranking.map((r, idx) => ({ ...r, posicao: idx + 1 })));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dashboard/metas - Status das metas
app.get('/api/dashboard/metas', auth, (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const metaDia = db.prepare('SELECT * FROM metas_globais WHERE periodo="diaria" AND mes_ano=?').get(hoje);
    const metaSemana = db.prepare('SELECT * FROM metas_globais WHERE periodo="semanal" AND mes_ano>=?').get(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const metaMes = db.prepare('SELECT * FROM metas_globais WHERE periodo="mensal" AND mes_ano=?').get(hoje.substring(0, 7) + '-01');

    res.json({
      dia: metaDia || null,
      semana: metaSemana || null,
      mes: metaMes || null
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dashboard/grafico-conversoes - Dados para gráfico de conversões (últimos 7 dias)
app.get('/api/dashboard/grafico-conversoes', auth, (req, res) => {
  try {
    const dados = [];
    for (let i = 6; i >= 0; i--) {
      const data = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const vendas = db.prepare('SELECT COUNT(*) as c FROM vendas WHERE date(criado_em)=?').get(data);
      const leads = db.prepare('SELECT COUNT(*) as c FROM leads WHERE date(criado_em)=?').get(data);
      dados.push({
        data,
        vendas: vendas?.c || 0,
        leads: leads?.c || 0,
        taxa: leads?.c > 0 ? Math.round((vendas?.c || 0) / leads.c * 100) : 0
      });
    }
    res.json(dados);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PAGAMENTOS ENDPOINTS

// GET /api/pagamentos - Lista pagamentos
app.get('/api/pagamentos', auth, (req, res) => {
  try {
    const pagamentos = db.prepare('SELECT * FROM pagamentos ORDER BY criado_em DESC').all();
    res.json(pagamentos);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/pagamentos - Registrar pagamento
app.post('/api/pagamentos', auth, (req, res) => {
  try {
    const { venda_id, data_pagamento, forma_pagamento } = req.body;
    if (!venda_id) return res.status(400).json({ error: 'venda_id obrigatório' });

    const venda = db.prepare('SELECT * FROM vendas WHERE id=?').get(venda_id);
    if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });

    const r = db.prepare(`
      INSERT INTO pagamentos (venda_id, cliente_nome, valor, data_pagamento, forma_pagamento, status)
      VALUES (?, ?, ?, ?, ?, 'PAGO')
    `).run(venda_id, venda.cliente_nome, venda.valor, data_pagamento || new Date().toISOString().split('T')[0], forma_pagamento || venda.pagamento);

    res.json({ ok: true, id: r.lastInsertRowid });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/pagamentos/:id - Atualizar entrega de vídeo
app.put('/api/pagamentos/:id', auth, (req, res) => {
  try {
    const { data_entrega_video } = req.body;
    db.prepare('UPDATE pagamentos SET data_entrega_video=? WHERE id=?').run(data_entrega_video, req.params.id);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// VÍDEOS ENDPOINTS

// GET /api/videos - Lista vídeos
app.get('/api/videos', auth, (req, res) => {
  try {
    const videos = db.prepare('SELECT * FROM videos ORDER BY data_entrega DESC').all();
    res.json(videos);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/videos - Upload metadata de vídeo (cru ou pronto)
app.post('/api/videos', auth, (req, res) => {
  try {
    const { cliente_nome, tipo, url, status } = req.body;
    if (!cliente_nome) return res.status(400).json({ error: 'cliente_nome obrigatório' });
    const r = db.prepare(`INSERT INTO videos (cliente_nome, tipo, url, status, data_entrega) VALUES (?,?,?,?,date('now','localtime'))`)
      .run(cliente_nome, tipo||'Cru', url||'', status||'Cru');
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/videos/:id - Atualizar status de vídeo
app.put('/api/videos/:id', auth, (req, res) => {
  try {
    const { status, url, tipo } = req.body;
    db.prepare('UPDATE videos SET status=COALESCE(?,status), url=COALESCE(?,url), tipo=COALESCE(?,tipo) WHERE id=?')
      .run(status||null, url||null, tipo||null, req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/videos/:id
app.delete('/api/videos/:id', auth, requireRole('admin','gestor'), (req, res) => {
  try {
    db.prepare('DELETE FROM videos WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/videos/enviar - Registrar envio de vídeo
app.post('/api/videos/enviar', auth, (req, res) => {
  try {
    const { venda_id, data_entrega, tipo } = req.body;
    if (!venda_id) return res.status(400).json({ error: 'venda_id obrigatório' });

    const venda = db.prepare('SELECT * FROM vendas WHERE id=?').get(venda_id);
    if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });

    const r = db.prepare(`
      INSERT INTO videos (venda_id, cliente_nome, tipo, data_entrega, status)
      VALUES (?, ?, ?, ?, 'ENVIADO')
    `).run(venda_id, venda.cliente_nome, tipo || 'Padrão', data_entrega || new Date().toISOString().split('T')[0]);

    // Notificar com push
    pushParaRoles(['admin', 'gestor'], '🎥 Vídeo enviado', `Vídeo enviado para ${venda.cliente_nome}`, '/videos');

    res.json({ ok: true, id: r.lastInsertRowid });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/videos/upload — Upload de arquivo de vídeo
app.post('/api/videos/upload', auth, (req, res, next) => {
  if (!upload) return res.status(501).json({ error: 'Upload não disponível (multer não instalado)' });
  upload.single('arquivo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, (req, res) => {
  try {
    const { cliente_nome, tipo, data_entrega } = req.body;
    const arquivo = req.file;
    if (!arquivo) return res.status(400).json({ error: 'Arquivo não enviado' });
    const url = '/uploads/' + arquivo.filename;
    const status = (tipo === 'Pronto' || tipo === 'pronto') ? 'PRONTO' : 'CRU';
    const r = db.prepare('INSERT INTO videos (cliente_nome, tipo, url, data_entrega, status) VALUES (?,?,?,?,?)')
      .run(cliente_nome || 'Sem nome', tipo || 'Cru', url, data_entrega || null, status);
    res.json({ ok: true, id: r.lastInsertRowid, url });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Servir uploads
app.use('/uploads', express.static(UPLOAD_DIR));

// INDICAÇÕES ENDPOINTS

// GET /api/indicacoes - Lista indicações
app.get('/api/indicacoes', auth, (req, res) => {
  try {
    const indicacoes = db.prepare('SELECT * FROM indicacoes ORDER BY criado_em DESC').all();
    res.json(indicacoes);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/indicacoes - Registrar indicação
app.post('/api/indicacoes', auth, (req, res) => {
  try {
    const { venda_id_indicador, novo_cliente_nome, novo_cliente_tel, quem_indicou, indicado_para, status, desconto_percentual } = req.body;
    // Aceita tanto o formato antigo (venda_id_indicador + novo_cliente_nome) quanto o novo (quem_indicou + indicado_para)
    const quemInd = quem_indicou || '';
    const indPara = indicado_para || novo_cliente_nome || '';
    if (!indPara && !quemInd) {
      return res.status(400).json({ error: 'Campos obrigatórios: quem_indicou e indicado_para' });
    }

    const r = db.prepare(`
      INSERT INTO indicacoes (venda_id_indicador, novo_cliente_nome, novo_cliente_tel, status, quem_indicou, indicado_para, desconto_percentual)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(venda_id_indicador||null, novo_cliente_nome||indPara, novo_cliente_tel||'', status||'em_negociacao', quemInd, indPara, desconto_percentual||0);

    res.json({ ok: true, id: r.lastInsertRowid });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// METAS GLOBAIS ENDPOINTS

// GET /api/metas-globais - Listar metas
app.get('/api/metas-globais', auth, (req, res) => {
  try {
    const metas = db.prepare('SELECT * FROM metas_globais ORDER BY mes_ano DESC').all();
    res.json(metas);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/metas-globais - Criar meta (admin/gestor)
app.post('/api/metas-globais', auth, requireRole('admin', 'gestor'), (req, res) => {
  try {
    const { periodo, tipo, valor_meta, mes_ano } = req.body;
    if (!periodo || !valor_meta) return res.status(400).json({ error: 'Campos obrigatórios' });

    const r = db.prepare(`
      INSERT INTO metas_globais (periodo, tipo, valor_meta, valor_realizado, mes_ano)
      VALUES (?, ?, ?, 0, ?)
    `).run(periodo, tipo || 'Vendas', valor_meta, mes_ano || new Date().toISOString().split('T')[0]);

    res.json({ ok: true, id: r.lastInsertRowid });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/metas-globais/:id - Atualizar meta (admin/gestor)
app.put('/api/metas-globais/:id', auth, requireRole('admin', 'gestor'), (req, res) => {
  try {
    const { valor_meta, valor_realizado } = req.body;
    db.prepare(`
      UPDATE metas_globais
      SET valor_meta=COALESCE(?,valor_meta), valor_realizado=COALESCE(?,valor_realizado)
      WHERE id=?
    `).run(valor_meta||null, valor_realizado||null, req.params.id);

    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// RANKING ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/ranking - Lista ranking dos atendentes
app.get('/api/ranking', auth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM ranking ORDER BY pontos DESC').all();
    res.json(rows.map((r, i) => ({ ...r, posicao: i + 1 })));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/ranking/:id - Admin pode editar pontos/vendas manualmente
app.put('/api/ranking/:id', auth, requireRole('admin', 'gestor'), (req, res) => {
  try {
    const { vendas, pontos } = req.body;
    db.prepare("UPDATE ranking SET vendas=COALESCE(?,vendas), pontos=COALESCE(?,pontos), updated_at=datetime('now','localtime') WHERE id=?")
      .run(vendas ?? null, pontos ?? null, req.params.id);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// SERVICOS ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════════

app.get('/api/servicos', auth, (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM servicos WHERE ativo=1 ORDER BY id').all());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/servicos', auth, requireRole('admin','gestor'), (req, res) => {
  try {
    const { nome, preco, descricao, cor } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
    const r = db.prepare('INSERT INTO servicos (nome, preco, descricao, cor) VALUES (?,?,?,?)').run(nome, preco||0, descricao||'', cor||'#2563eb');
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/servicos/:id', auth, requireRole('admin','gestor'), (req, res) => {
  try {
    const { nome, preco, descricao, cor } = req.body;
    db.prepare('UPDATE servicos SET nome=COALESCE(?,nome), preco=COALESCE(?,preco), descricao=COALESCE(?,descricao), cor=COALESCE(?,cor) WHERE id=?')
      .run(nome||null, preco??null, descricao||null, cor||null, req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/servicos/:id', auth, requireRole('admin','gestor'), (req, res) => {
  try {
    db.prepare('UPDATE servicos SET ativo=0 WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// INDICACOES ENDPOINTS (nova versão completa)
// ════════════════════════════════════════════════════════════════════════════════

// PUT /api/indicacoes/:id - Atualizar status/desconto de uma indicação
app.put('/api/indicacoes/:id', auth, (req, res) => {
  try {
    const { status, desconto_percentual, quem_indicou, indicado_para } = req.body;
    db.prepare(`UPDATE indicacoes SET
      status=COALESCE(?,status),
      desconto_percentual=COALESCE(?,desconto_percentual),
      quem_indicou=COALESCE(?,quem_indicou),
      indicado_para=COALESCE(?,indicado_para)
      WHERE id=?`).run(status||null, desconto_percentual??null, quem_indicou||null, indicado_para||null, req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/calendario - Eventos do calendário (pagamentos + vídeos)
app.get('/api/calendario', auth, (req, res) => {
  try {
    const eventos = [];

    // Eventos de pagamentos
    const pagamentos = db.prepare('SELECT * FROM pagamentos WHERE data_pagamento IS NOT NULL').all();
    pagamentos.forEach(p => {
      eventos.push({
        id: 'pag-' + p.id,
        title: 'Pagamento: ' + p.cliente_nome,
        start: p.data_pagamento,
        tipo: 'pagamento',
        status: p.status
      });
    });

    // Eventos de vídeos
    const videos = db.prepare('SELECT * FROM videos WHERE data_entrega IS NOT NULL').all();
    videos.forEach(v => {
      eventos.push({
        id: 'vid-' + v.id,
        title: 'Vídeo: ' + v.cliente_nome,
        start: v.data_entrega,
        tipo: 'video',
        status: v.status
      });
    });

    res.json(eventos);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// RELATÓRIOS ENDPOINTS

// GET /api/relatorios/vendas-csv - Exportar vendas como CSV
app.get('/api/relatorios/vendas-csv', auth, (req, res) => {
  try {
    const periodo = req.query.periodo || 'mes';
    let where = '1=1';
    const hoje = new Date();

    if (periodo === 'dia') {
      where = `date(v.criado_em)=date('now','localtime')`;
    } else if (periodo === 'semana') {
      where = `date(v.criado_em)>=date('now','localtime','-7 days')`;
    } else if (periodo === 'mes') {
      where = `date(v.criado_em)>=date('now','localtime','-30 days')`;
    }

    const vendas = db.prepare(`
      SELECT v.id, v.cliente_nome, v.valor, v.pagamento, v.servico, v.criado_em, u.nome as atendente
      FROM vendas v
      LEFT JOIN usuarios u ON v.criado_por=u.id
      WHERE ${where}
      ORDER BY v.criado_em DESC
    `).all();

    // Gerar CSV
    const headers = 'ID,Cliente,Valor,Pagamento,Serviço,Atendente,Data\n';
    const rows = vendas.map(v => `${v.id},"${v.cliente_nome}",${v.valor},"${v.pagamento}","${v.servico}","${v.atendente}","${v.criado_em}"`).join('\n');
    const csv = headers + rows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vendas-${periodo}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/relatorios/desempenho - Relatório de desempenho de atendentes
app.get('/api/relatorios/desempenho', auth, requireRole('admin', 'gestor'), (req, res) => {
  try {
    const data = {};

    // Total de vendas e ticket médio
    const vendas = db.prepare('SELECT SUM(valor) as total, COUNT(*) as count, AVG(valor) as media FROM vendas WHERE date(criado_em)>=date("now","localtime","-30 days")').get();

    // Top 5 atendentes
    const top = db.prepare(`
      SELECT u.nome, COUNT(v.id) as vendas, SUM(v.valor) as valor_total, AVG(v.valor) as ticket_medio, COALESCE(SUM(pa.pontos), 0) as pontos
      FROM usuarios u
      LEFT JOIN vendas v ON u.id=v.criado_por AND date(v.criado_em)>=date('now','localtime','-30 days')
      LEFT JOIN pontuacao_atendentes pa ON u.id=pa.usuario_id AND date(pa.data)>=date('now','localtime','-30 days')
      WHERE u.ativo=1
      GROUP BY u.id
      ORDER BY vendas DESC
      LIMIT 5
    `).all();

    // Conversão diária (últimos 7 dias)
    const conv = [];
    for (let i = 6; i >= 0; i--) {
      const data_busca = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const leads_day = db.prepare('SELECT COUNT(*) as c FROM leads WHERE date(criado_em)=?').get(data_busca);
      const vendas_day = db.prepare('SELECT COUNT(*) as c FROM vendas WHERE date(criado_em)=?').get(data_busca);
      conv.push({ data: data_busca, leads: leads_day?.c || 0, vendas: vendas_day?.c || 0, taxa: (leads_day?.c > 0 ? Math.round((vendas_day?.c || 0) / leads_day.c * 100) : 0) + '%' });
    }

    res.json({
      periodo: 'Últimos 30 dias',
      resumo: {
        total_vendas: vendas?.total || 0,
        quantidade: vendas?.count || 0,
        ticket_medio: Math.round(vendas?.media || 0)
      },
      top_atendentes: top,
      conversao_7dias: conv
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Função auxiliar para atualizar pontos e metas quando cria venda
// Esta função é chamada após INSERT em vendas
function atualizarPontosEMetas(venda_id) {
  try {
    const venda = db.prepare('SELECT * FROM vendas WHERE id=?').get(venda_id);
    if (!venda) return;

    // Calcular e inserir pontos
    const pontos = calcularPontos(venda.valor);
    const faixa = getFaixaValor(venda.valor);
    const data = new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO pontuacao_atendentes (usuario_id, venda_id, pontos, faixa_valor, data)
      VALUES (?, ?, ?, ?, ?)
    `).run(venda.criado_por, venda_id, pontos, faixa, data);

    // Atualizar metas globais
    const hoje = data;
    const mesAtual = data.substring(0, 7);
    const dataInicio7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Meta diária
    db.prepare(`
      UPDATE metas_globais
      SET valor_realizado = valor_realizado + ?
      WHERE periodo='diaria' AND mes_ano=?
    `).run(venda.valor, hoje);

    // Meta semanal
    db.prepare(`
      UPDATE metas_globais
      SET valor_realizado = valor_realizado + ?
      WHERE periodo='semanal' AND mes_ano>=?
    `).run(venda.valor, dataInicio7);

    // Meta mensal
    db.prepare(`
      UPDATE metas_globais
      SET valor_realizado = valor_realizado + ?
      WHERE periodo='mensal' AND mes_ano=?
    `).run(venda.valor, mesAtual + '-01');
  } catch(e) {
    console.error('Erro ao atualizar pontos:', e.message);
  }
}

// Enviar push para usuários por role
function pushParaRoles(roles, titulo, corpo, url) {
  const subs = db.prepare('SELECT ps.* FROM push_subscriptions ps JOIN usuarios u ON u.id=ps.user_id WHERE u.role IN (' + roles.map(()=>'?').join(',') + ')').all(roles);
  subs.forEach(sub => {
    const payload = JSON.stringify({ title: titulo, body: corpo, url: url || '/' });
    if (!webpush) return;
    webpush.sendNotification({ endpoint: sub.endpoint, keys: { auth: sub.keys_auth, p256dh: sub.keys_p256dh } }, payload)
      .catch(e => {
        if (e.statusCode === 410 || e.statusCode === 404) {
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').run(sub.endpoint);
        }
      });
  });
}

// Notificar novo acesso (chamado no login)
function notificarNovoAcesso(nomeUsuario, role) {
  if (role === 'admin') return; // admin não notifica a si mesmo
  pushParaRoles(['admin', 'gestor'], '🔐 Novo acesso ao CRM', `${nomeUsuario} acabou de entrar no sistema`, '/');
}

// ── Cron jobs de notificação ──────────────────────────────────────────────────

// A cada 1 hora: verificar leads e mensagens sem resposta
setInterval(() => {
  const agora = new Date();

  // 1) Leads na última hora
  try {
    const leads = db.prepare(`SELECT COUNT(*) as c FROM leads WHERE criado_em >= datetime('now','-1 hour','localtime')`).get();
    if (leads && leads.c > 0) {
      pushParaRoles(['admin','gestor','gerente'],
        `📋 ${leads.c} novo${leads.c>1?'s':''} lead${leads.c>1?'s':''} na última hora`,
        `Você tem ${leads.c} lead${leads.c>1?'s':''} aguardando atendimento no CRM`,
        '/');
    }
  } catch(e) {}

  // 2) Mensagens sem resposta há mais de 1 hora (admin notifica)
  try {
    const semResposta = db.prepare(`
      SELECT COUNT(DISTINCT lead_id) as c FROM chat_messages
      WHERE remetente_role != 'admin' AND remetente_role != 'gestor'
        AND criado_em <= datetime('now','-1 hour','localtime')
        AND lead_id NOT IN (
          SELECT DISTINCT lead_id FROM chat_messages
          WHERE (remetente_role='admin' OR remetente_role='gestor')
            AND criado_em >= datetime('now','-1 hour','localtime')
        )
    `).get();
    if (semResposta && semResposta.c > 0) {
      pushParaRoles(['admin','gestor'],
        `⚠️ ${semResposta.c} lead${semResposta.c>1?'s':''} sem resposta`,
        `Há mensagem${semResposta.c>1?'ns':''} de cliente${semResposta.c>1?'s':''} sem resposta há mais de 1 hora`,
        '/');
    }
  } catch(e) {}

}, 60 * 60 * 1000); // 1 hora

// ── Catch-all: serve index.html para rotas do frontend ───────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Iniciar servidor ──────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 LS Impulsiona rodando em http://localhost:' + PORT);
  console.log('📊 Banco: ' + DB_PATH);
  console.log('\n👥 Credenciais padrão:');
  console.log('   lary      / admin123   (Admin)');
  console.log('   gestor    / gestor123  (Gestor)');
  console.log('   atendente / atend123   (Atendente)');
  console.log('   vendedor  / vend123    (Vendedor)');
  console.log('\n⚠️  Troque as senhas após o primeiro acesso!\n');
});
