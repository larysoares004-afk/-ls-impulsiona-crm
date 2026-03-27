# 🗄️ BANCO DE DADOS - LS IMPULSIONA CRM

## Visão Geral

O banco de dados usa **SQLite 3** com as seguintes tabelas principais:

```
usuarios          →  Usuários do CRM
leads             →  Leads/formulários
vendas            →  Vendas convertidas
wpp_contas        →  Contas WhatsApp
wpp_mensagens     →  Mensagens WhatsApp
wpp_transferencias→  Transferências de conversa
instagram_contas  →  Contas Instagram
instagram_mensagens→ Mensagens Instagram
instagram_transferencias→ Transferências IG
config            →  Configurações (tokens, webhooks)
```

---

## 👥 TABELA: usuarios

Usuários que acessam o CRM

```sql
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  nome TEXT NOT NULL,
  cargo TEXT,
  role TEXT DEFAULT 'atendente',  -- admin, gestor, atendente, vendedor
  setor TEXT DEFAULT 'Geral',
  ativo INTEGER DEFAULT 1,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  ultimo_acesso DATETIME
);
```

**Roles disponíveis:**
- `admin` - Acesso total
- `gestor` - Pode configurar, ver relatórios
- `atendente` - Pode responder mensagens
- `vendedor` - Pode converter leads em vendas

---

## 📱 TABELA: wpp_contas

Contas WhatsApp configuradas

```sql
CREATE TABLE wpp_contas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL,
  phone_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  ativo INTEGER DEFAULT 1,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Exemplo:**
```json
{
  "id": 1,
  "token": "EAAAAhz...",
  "phone_id": "1025821790609502",
  "business_id": "123456789",
  "ativo": 1
}
```

---

## 💬 TABELA: wpp_mensagens

Histórico de mensagens WhatsApp

```sql
CREATE TABLE wpp_mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wamid TEXT UNIQUE,              -- WhatsApp Message ID
  de TEXT NOT NULL,               -- Número do cliente
  nome TEXT,                       -- Nome do cliente
  texto TEXT,
  tipo TEXT DEFAULT 'text',       -- text, image, audio, etc
  direcao TEXT DEFAULT 'recebida',-- recebida ou enviada
  lido INTEGER DEFAULT 0,         -- 0=não lido, 1=lido
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Campos:**
- `de`: Número do WhatsApp (ex: 5571981234567)
- `texto`: Conteúdo da mensagem
- `direcao`: "recebida" (cliente → atendente) ou "enviada" (atendente → cliente)
- `lido`: Se foi lido pelo atendente

---

## 🔄 TABELA: wpp_transferencias

Histórico de transferências de conversa

```sql
CREATE TABLE wpp_transferencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversa_de TEXT NOT NULL,      -- Número do cliente
  de_usuario_id INTEGER,
  de_usuario_nome TEXT,
  para_usuario_id INTEGER,
  para_usuario_nome TEXT,
  para_setor TEXT,
  motivo TEXT,
  transferida_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📸 TABELA: instagram_mensagens

Mensagens Instagram Direct

```sql
CREATE TABLE instagram_mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  igid TEXT UNIQUE,                -- Instagram Message ID
  de TEXT NOT NULL,                -- Instagram ID do usuário
  nome TEXT,
  username TEXT,                   -- @username do Instagram
  texto TEXT,
  tipo TEXT DEFAULT 'text',
  direcao TEXT DEFAULT 'recebida',
  lido INTEGER DEFAULT 0,
  foto_url TEXT,                   -- URL da foto do usuário
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Campos:**
- `de`: ID do usuário Instagram (ex: 2055366968346312)
- `username`: @username do Instagram
- `foto_url`: URL do avatar do usuário

---

## 🔄 TABELA: instagram_transferencias

Transferências de conversa Instagram

```sql
CREATE TABLE instagram_transferencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversa_de TEXT NOT NULL,
  de_usuario_id INTEGER,
  de_usuario_nome TEXT,
  para_usuario_id INTEGER,
  para_usuario_nome TEXT,
  para_setor TEXT,
  motivo TEXT,
  transferida_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📋 TABELA: leads

Leads/formulários enviados

```sql
CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  telefone TEXT,
  origem TEXT DEFAULT 'Landing Page',
  status TEXT DEFAULT 'LEAD',      -- LEAD, AGENDADO, CONVERTEU
  motivo TEXT,                     -- Exame de Vista, Armação, etc
  oculos TEXT DEFAULT 'Sim',
  valor REAL DEFAULT 20.0,
  os TEXT,                         -- Número da OS
  unidade TEXT DEFAULT 'Conquista',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME
);
```

---

## 💰 TABELA: vendas

Vendas convertidas

```sql
CREATE TABLE vendas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  cliente_nome TEXT,
  valor REAL NOT NULL,
  pagamento TEXT DEFAULT 'PIX',   -- PIX, Dinheiro, Débito, Crédito
  servico TEXT,
  tipo TEXT DEFAULT 'Venda',
  criado_por INTEGER,             -- ID do usuário que criou
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## ⚙️ TABELA: config

Configurações e tokens

```sql
CREATE TABLE config (
  chave TEXT PRIMARY KEY,
  valor TEXT                       -- JSON string
);
```

**Chaves utilizadas:**

| Chave | Tipo | Exemplo |
|-------|------|---------|
| `whatsapp_meta` | JSON | `{"token":"...", "phone_id":"...", "business_id":"..."}` |
| `instagram_meta` | JSON | `{"token":"...", "business_id":"..."}` |
| `n8n_config` | JSON | `{"webhook_url":"https://..."}` |
| `n8n_token` | JSON | `"seu_token_secreto"` |

---

## 📊 Queries Úteis

### Contar mensagens não lidas:
```sql
SELECT COUNT(*) FROM wpp_mensagens WHERE lido=0 AND direcao='recebida';
```

### Conversas mais recentes:
```sql
SELECT DISTINCT de, nome, MAX(criado_em) as ultima
FROM wpp_mensagens
GROUP BY de
ORDER BY ultima DESC
LIMIT 10;
```

### Leads convertidos:
```sql
SELECT COUNT(*) FROM leads WHERE status='CONVERTEU';
```

### Total de receita:
```sql
SELECT SUM(valor) FROM vendas;
```

### Mensagens por período:
```sql
SELECT DATE(criado_em) as data, COUNT(*) as total
FROM wpp_mensagens
WHERE direcao='recebida'
GROUP BY DATE(criado_em)
ORDER BY data DESC;
```

---

## 🔐 Índices para Performance

```sql
CREATE INDEX idx_wpp_de ON wpp_mensagens(de);
CREATE INDEX idx_wpp_criado_em ON wpp_mensagens(criado_em);
CREATE INDEX idx_ig_de ON instagram_mensagens(de);
CREATE INDEX idx_ig_criado_em ON instagram_mensagens(criado_em);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_vendas_criado_em ON vendas(criado_em);
```

---

## 📈 Backup e Recuperação

### Backup do banco:
```bash
sqlite3 /data/ls-impulsiona.db ".dump" > backup.sql
```

### Restaurar backup:
```bash
sqlite3 /data/ls-impulsiona.db < backup.sql
```

### Limpar banco (reset):
```bash
rm /data/ls-impulsiona.db
# O app vai recriar com schema vazio
```

---

**Versão**: 1.0.0
**Última atualização**: 27/03/2026
