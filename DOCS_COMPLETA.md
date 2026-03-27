# 📚 DOCUMENTAÇÃO COMPLETA - LS IMPULSIONA CRM

## Índice
1. [Visão Geral da Arquitetura](#arquitetura)
2. [Instalação e Deploy](#deploy)
3. [Configuração WhatsApp](#whatsapp)
4. [Configuração Instagram](#instagram)
5. [Configuração N8N (IA)](#n8n)
6. [API Documentation](#api)
7. [Banco de Dados](#banco)
8. [Troubleshooting](#troubleshooting)

---

## 🏗️ ARQUITETURA {#arquitetura}

### Stack Tecnológico:
```
Frontend: HTML5 + CSS3 + Vanilla JavaScript
Backend: Node.js 20 + Express 4.21
Banco: SQLite 3
APIs: Meta Graph API v20.0
IA: N8N Webhooks
Deploy: Railway (Docker)
```

### Fluxo de Dados:
```
Cliente (WhatsApp/Instagram/Lead Form)
         ↓
    Webhook Meta / Form Submit
         ↓
    server.js (Node.js)
         ↓
    SQLite Database
         ↓
    Frontend (index.html)
         ↓
    Atendente
         ↓
    Responde via /api/*/enviar
         ↓
    Meta API → Cliente
```

### Estrutura de Pastas:
```
ls-impulsiona-crm/
├── server.js              # Backend principal
├── public/
│   ├── index.html         # Frontend (Dashboard)
│   ├── style.css          # Estilos (inline)
│   └── script.js          # JavaScript (inline)
├── Dockerfile             # Container Docker
├── package.json           # Dependências
├── railway.toml           # Config Railway
├── DOCS_COMPLETA.md       # Este arquivo
├── SETUP.md               # Setup passo-a-passo
├── API.md                 # Documentação de APIs
└── BANCO.md               # Estrutura do banco
```

---

## 🚀 INSTALAÇÃO E DEPLOY {#deploy}

### Pré-requisitos:
- Node.js 18+
- Git
- Conta Railway.app
- Conta GitHub

### 1. Clone/Copie o Projeto:
```bash
git clone https://github.com/SEU_USERNAME/ls-impulsiona-crm.git
cd ls-impulsiona-crm
npm install
```

### 2. Variáveis de Ambiente:
Crie arquivo `.env`:
```
NODE_ENV=production
PORT=8080
JWT_SECRET=LS_IMPULSIONA_JWT_SECRET_2024
DATABASE_PATH=/data/ls-impulsiona.db
```

### 3. Rodando Localmente:
```bash
npm start
# Acessa em http://localhost:8080
```

### 4. Deploy no Railway:
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

Ou via Dashboard:
1. https://railway.app
2. New Project → GitHub repo → ls-impulsiona-crm
3. Configure variables de ambiente
4. Deploy automático!

---

## 📱 CONFIGURAÇÃO WHATSAPP {#whatsapp}

### O que você precisa:
- Conta Business do Meta
- Business Account ID
- Phone Number ID
- Access Token (da conta Business)

### Passo-a-passo:

#### 1. Criar App Meta:
1. https://developers.facebook.com
2. Meus Apps → Criar App
3. Tipo: Business
4. Nome: "LS Impulsiona WhatsApp"

#### 2. Adicionar Produto WhatsApp:
1. No app, clique em "Adicionar Produto"
2. Busque "WhatsApp"
3. Clique "Configurar"

#### 3. Obter Credenciais:
- **Business Account ID**: Configurações → Informações da conta
- **Phone Number ID**: WhatsApp → Phone Numbers
- **Access Token**: WhatsApp → API Access

#### 4. No CRM (Configurações > WhatsApp):
Preencha:
- Token: `XXXXXXXXXXX` (seu access token)
- Phone ID: `1025821790609502` (seu phone ID)
- Business ID: `123456789` (seu business account ID)

#### 5. Testar:
1. Envie mensagem pelo WhatsApp
2. Deve aparecer em "Atendimentos"
3. Responda pelo CRM

---

## 📸 CONFIGURAÇÃO INSTAGRAM {#instagram}

### O que você precisa:
- Conta Business Instagram conectada ao Meta
- Business Account ID
- Access Token (com permissões Instagram)

### Passo-a-passo:

#### 1. No Meta App Manager:
1. https://developers.facebook.com
2. Seu app → Produtos → Instagram Basic Display
3. Setup Basic Display

#### 2. Obter Business Account ID:
```
Business Account ID da conta Instagram: 17841448115950083 (exemplo)
```

#### 3. Webhook Configuration:
1. Configurações → Webhooks
2. URL: `https://seu-dominio.railway.app/api/instagram/webhook`
3. Verify Token: `alliance_instagram_2024` (definido no CRM)
4. Ativar eventos: `messages`, `message_edit`, `message_seen`

#### 4. No CRM (Configurações > Instagram):
- Token: `IGAAUMhspJadhBZAGJxSWZA...` (seu token)
- Business ID: `17841448115950083` (auto-preenchido)

#### 5. Testar:
1. Envie DM para sua conta Instagram
2. Deve aparecer em "Atendimentos > Instagram"

---

## 🤖 CONFIGURAÇÃO N8N (IA) {#n8n}

### O que é:
N8N é uma plataforma de automação que processa mensagens e ativa uma IA para responder automaticamente.

### Fluxo:
```
Mensagem chega → CRM dispara para N8N → IA processa → Resposta volta → Enviada ao cliente
```

### Setup N8N:

#### 1. Criar conta em n8n.io
https://n8n.io

#### 2. Criar Workflow:
- New Workflow
- Adicionar "Webhook" trigger
- Configure para receber POST

#### 3. Conectar IA:
```json
Webhook recebe:
{
  "canal": "whatsapp",
  "de": "5571981234567",
  "nome": "João",
  "texto": "Olá, quero marcar uma consulta"
}
```

#### 4. Processar com IA:
- Use OpenAI / ChatGPT / sua IA
- Instruções: responder sobre agendamentos, saudações, etc
- Retorne: `{ texto: "resposta aqui" }`

#### 5. Webhook de Saída:
```
POST https://seu-dominio.railway.app/api/ia/resposta
Body:
{
  "canal": "whatsapp",
  "para": "5571981234567",
  "texto": "Olá João! Você pode marcar sua consulta aqui...",
  "token_ia": "TOKEN_QUE_VOCE_DEFINIU"
}
```

#### 6. No CRM (Configurações > N8N):
- URL do Webhook N8N: `https://seu-n8n.com/webhook/xxxxx`
- Token de Segurança: `seu_token_secreto_aqui`

---

## 📡 API DOCUMENTATION {#api}

### Autenticação:
```
Header: Authorization: Bearer SEU_JWT_TOKEN
```

### Endpoints Principais:

#### WhatsApp:
```
GET /api/whatsapp/contas
POST /api/whatsapp/contas
GET /api/whatsapp/conversas
GET /api/whatsapp/mensagens/:de
POST /api/whatsapp/enviar { para, texto }
POST /api/whatsapp/transferir { conversa_de, para_usuario, para_nome, para_setor, motivo }
```

#### Instagram:
```
GET /api/instagram/conversas
GET /api/instagram/mensagens/:de
POST /api/instagram/enviar { para, texto }
POST /api/instagram/transferir { conversa_de, para_usuario, para_nome, para_setor, motivo }
```

#### IA/N8N:
```
POST /api/ia/resposta { canal, para, texto, token_ia }
PUT /api/config/n8n { webhook_url, token }
GET /api/config/n8n
```

#### Leads:
```
GET /api/leads
POST /api/leads/public { nome, telefone, motivo, unidade }
PUT /api/leads/:id { status, telefone, etc }
```

Detalhes completos em: **API.md**

---

## 🗄️ BANCO DE DADOS {#banco}

### Tabelas Principais:

#### usuarios
```
id, usuario, senha (bcrypt), nome, cargo, role, setor, ativo, criado_em, ultimo_acesso
```

#### wpp_contas
```
id, token, phone_id, business_id, ativo, criado_em
```

#### wpp_mensagens
```
id, wamid, de, nome, texto, tipo, direcao (enviada/recebida), lido, criado_em
```

#### instagram_mensagens
```
id, igid, de, nome, username, texto, tipo, direcao, lido, foto_url, criado_em
```

#### config
```
chave (whatsapp_meta, instagram_meta, n8n_config, n8n_token, ...), valor (JSON)
```

Estrutura completa em: **BANCO.md**

---

## 🆘 TROUBLESHOOTING {#troubleshooting}

### Mensagens não chegam
✓ Verificar se webhook URL está correta no Meta
✓ Verificar se verify token bate
✓ Consultar logs do servidor: `railway logs`
✓ Testar webhook manualmente no Meta

### Erro "Token inválido"
✓ Gerar novo token no Meta
✓ Verificar se está salvo no CRM
✓ Verificar se não expirou

### IA não responde
✓ Verificar se N8N URL está correta
✓ Verificar se token_ia está correto
✓ Testar webhook do N8N manualmente
✓ Verificar logs do N8N

### Servidor travado
✓ Verificar se há muitas conexões abertas
✓ Reiniciar container no Railway
✓ Aumentar recursos (CPU/RAM)

### Banco de dados corrompido
✓ Ir em Railway → Data → Remover volume
✓ Fazer deploy de novo

---

## 📞 Suporte

Para dúvidas técnicas:
1. Consulte **API.md**
2. Consulte **BANCO.md**
3. Consulte logs: `railway logs --service ls-impulsiona-crm`
4. Abra issue no GitHub

---

**Documentação atualizada**: 27/03/2026
**Versão CRM**: 1.0.0
**Status**: ✅ Production Ready
