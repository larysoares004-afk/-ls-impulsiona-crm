/**
 * LS INTERNATIONAL — Servidor independente do site institucional
 * Sem banco de dados Alliance, sem CRM, sem sessões
 * Leads são enviados ao WhatsApp via API
 */
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const crypto = require('crypto');

const PORT       = process.env.SITE_PORT || 3000;
const WA_NUMBER  = process.env.WA_NUMBER || '5511974442004';
const SECRET_KEY = process.env.SITE_SECRET || crypto.randomBytes(32).toString('hex');

// Pasta onde os arquivos do site ficam
const SITE_DIR = path.join(__dirname, 'public', 'site');

// Arquivo de leads criptografados (separado do banco Alliance)
const LEADS_FILE = path.join(__dirname, 'leads.enc');

// Tipos MIME
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

// ── Criptografia simples para leads ──────────────────────────────────────────
function encryptLead(data) {
  const iv  = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(SECRET_KEY).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
}

function saveLead(data) {
  try {
    const line = encryptLead({ ...data, ts: new Date().toISOString() }) + '\n';
    fs.appendFileSync(LEADS_FILE, line, 'utf8');
  } catch (_) { /* silencioso */ }
}

// ── Roteador ──────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // CORS para assets
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ── POST /api/contact — recebe lead e manda ao WhatsApp ───────────────────
  if (req.method === 'POST' && url.pathname === '/api/contact') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 8000) req.destroy(); });
    req.on('end', () => {
      try {
        const d = JSON.parse(body);
        const required = ['name', 'email', 'whatsapp'];
        for (const f of required) {
          if (!d[f] || !String(d[f]).trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Campo obrigatório: ' + f }));
          }
        }

        // Salva lead criptografado
        saveLead(d);

        // Monta URL do WhatsApp
        const msg = '🚀 *Novo Lead — LS International*\n\n'
          + '*Nome:* '    + (d.name    || '') + '\n'
          + '*E-mail:* '  + (d.email   || '') + '\n'
          + '*WhatsApp:* '+ (d.whatsapp|| '') + '\n'
          + (d.company ? '*Empresa:* '  + d.company + '\n' : '')
          + (d.service ? '*Serviço:* '  + d.service + '\n' : '')
          + (d.message ? '\n*Mensagem:*\n' + d.message : '');

        const waUrl = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, redirect: waUrl }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Dados inválidos' }));
      }
    });
    return;
  }

  // ── Serve arquivos estáticos ───────────────────────────────────────────────
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }

  let filePath = url.pathname;

  // Rota raiz → index.html
  if (filePath === '/' || filePath === '') filePath = '/index.html';

  // Remove traversal
  const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.join(SITE_DIR, safePath);

  // Garantia que está dentro do SITE_DIR
  if (!full.startsWith(SITE_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  // Se for diretório, tenta index.html
  const stat = fs.existsSync(full) ? fs.statSync(full) : null;
  const target = (stat && stat.isDirectory())
    ? path.join(full, 'index.html')
    : full;

  if (!fs.existsSync(target)) {
    // SPA fallback → index.html
    const indexFallback = path.join(SITE_DIR, 'index.html');
    if (fs.existsSync(indexFallback)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(indexFallback).pipe(res);
    }
    res.writeHead(404);
    return res.end('Not found');
  }

  const ext  = path.extname(target).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  // Cache: 1h para assets, sem cache para HTML
  const isHtml  = ext === '.html';
  const maxAge  = isHtml ? 0 : 3600;
  res.setHeader('Cache-Control', isHtml ? 'no-cache' : `public, max-age=${maxAge}`);
  res.setHeader('Content-Type', mime);

  // Compressão gzip se disponível (Node ≥18)
  try {
    const zlib = require('zlib');
    const accept = req.headers['accept-encoding'] || '';
    if (accept.includes('gzip') && (ext === '.html' || ext === '.css' || ext === '.js')) {
      res.setHeader('Content-Encoding', 'gzip');
      fs.createReadStream(target).pipe(zlib.createGzip()).pipe(res);
      return;
    }
  } catch (_) {}

  fs.createReadStream(target).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n✅ LS International — Site Institucional');
  console.log('   Rodando em: http://localhost:' + PORT);
  console.log('   Leads encriptados em: ' + LEADS_FILE);
  console.log('\n   Para produção defina:');
  console.log('   SITE_PORT=3000  WA_NUMBER=5511974442004  SITE_SECRET=<chave-segura>\n');
});

module.exports = server;
