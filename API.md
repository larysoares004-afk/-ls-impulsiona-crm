# 📡 API DOCUMENTATION - LS IMPULSIONA CRM

## Autenticação

Todas as requisições (exceto webhooks e /api/leads/public) requerem JWT token:

```
Header: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Token obtido em:
```
POST /api/login
Body: { usuario, senha }
Response: { token, usuario: { id, nome, role, ... } }
```

---

## 🟢 WhatsApp Endpoints

### GET /api/whatsapp/contas
Listar todas as contas WhatsApp configuradas

**Response:**
```json
[
  {
    "id": 1,
    "token": "XXXXXXXXXXX",
    "phone_id": "1025821790609502",
    "business_id": "123456789",
    "ativo": true,
    "token_ok": 1,
    "criado_em": "2026-03-27 10:00:00"
  }
]
```

### POST /api/whatsapp/contas
Criar/atualizar conta WhatsApp

**Body:**
```json
{
  "token": "XXXXXXXXXXX",
  "phone_id": "1025821790609502",
  "business_id": "123456789"
}
```

### GET /api/whatsapp/conversas
Listar conversas WhatsApp

**Response:**
```json
[
  {
    "id": 1,
    "de": "5571981234567",
    "nome": "João Silva",
    "ultima_msg": "Olá, tudo bem?",
    "ultima": "2026-03-27 15:30:45",
    "nao_lidas": 2,
    "token_ok": 1
  }
]
```

### GET /api/whatsapp/mensagens/:de
Buscar mensagens de um usuário

**Params:**
- `de`: Número do WhatsApp (ex: 5571981234567)

**Response:**
```json
[
  {
    "id": 1,
    "de": "5571981234567",
    "nome": "João Silva",
    "texto": "Olá, quero agendar",
    "tipo": "text",
    "direcao": "recebida",
    "lido": true,
    "criado_em": "2026-03-27 15:30:45"
  }
]
```

### POST /api/whatsapp/enviar
Enviar mensagem WhatsApp

**Body:**
```json
{
  "para": "5571981234567",
  "texto": "Olá João! Sua consulta foi agendada para amanhã às 10h"
}
```

**Response:**
```json
{
  "ok": true,
  "message_id": "wamid.123456789"
}
```

### POST /api/whatsapp/transferir
Transferir conversa para outro usuário

**Body:**
```json
{
  "conversa_de": "5571981234567",
  "para_usuario": 2,
  "para_nome": "Maria Atendente",
  "para_setor": "Agendamentos",
  "motivo": "Cliente solicitou cambio de hora"
}
```

---

## 🟣 Instagram Endpoints

### GET /api/instagram/conversas
Listar conversas Instagram

**Response:**
```json
[
  {
    "de": "2055366968346312",
    "nome": "danmenezesfsa",
    "username": "danmenezesfsa",
    "foto_url": "https://...",
    "ultima_msg": "Oi, tudo bem?",
    "ultima": "2026-03-27 14:20:00",
    "nao_lidas": 1
  }
]
```

### GET /api/instagram/mensagens/:de
Buscar mensagens de conversa Instagram

**Params:**
- `de`: Instagram ID do usuário

### POST /api/instagram/enviar
Enviar mensagem Instagram

**Body:**
```json
{
  "para": "2055366968346312",
  "texto": "Olá! Como posso ajudar?"
}
```

### POST /api/instagram/transferir
Transferir conversa Instagram

---

## 🤖 IA / N8N Endpoints

### POST /api/ia/resposta
Webhook que recebe resposta da IA

**Body:**
```json
{
  "canal": "whatsapp",
  "para": "5571981234567",
  "texto": "Olá João! Pode sim marcar sua consulta...",
  "token_ia": "SEU_TOKEN_SEGURO"
}
```

**Validações:**
- token_ia deve ser igual ao salvo em config
- para deve ser numérico (7-20 dígitos)
- canal deve ser "whatsapp" ou "instagram"
- texto obrigatório

**Response:**
```json
{
  "ok": true,
  "data": {
    "message_id": "..."
  }
}
```

### GET /api/config/n8n
Buscar configuração N8N (requer admin/gestor)

**Response:**
```json
{
  "webhook_url": "https://...",
  "token": "***"
}
```

### PUT /api/config/n8n
Atualizar configuração N8N (requer admin/gestor)

**Body:**
```json
{
  "webhook_url": "https://n8n.seu-dominio.com/webhook/xxxxx",
  "token": "seu_token_secreto"
}
```

---

## 📋 Leads Endpoints

### GET /api/leads
Listar todos os leads (requer auth)

### POST /api/leads/public
Criar lead via formulário público (SEM auth)

**Body:**
```json
{
  "nome": "João Silva",
  "telefone": "11981234567",
  "motivo": "Exame de Vista",
  "unidade": "Feira de Santana",
  "oculos": "Sim"
}
```

**Response:**
```json
{
  "ok": true,
  "id": 123
}
```

### PUT /api/leads/:id
Atualizar lead

**Body:**
```json
{
  "status": "CONVERTEU",
  "telefone": "11987654321"
}
```

### DELETE /api/leads/:id
Deletar lead (requer admin/gestor)

---

## 👥 Usuários Endpoints

### POST /api/login
Fazer login

**Body:**
```json
{
  "usuario": "lary",
  "senha": "admin123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": 1,
    "usuario": "lary",
    "nome": "Laryssa",
    "role": "admin",
    "setor": "TI"
  }
}
```

### GET /api/usuarios
Listar usuários (requer auth)

### POST /api/usuarios
Criar usuário (requer admin)

**Body:**
```json
{
  "usuario": "novo_user",
  "senha": "senha123",
  "nome": "Novo Usuário",
  "role": "atendente",
  "setor": "Atendimento"
}
```

---

## 🔧 Configuração Endpoints

### PUT /api/config/whatsapp-meta
Salvar token WhatsApp (auto-ativa Instagram)

**Body:**
```json
{
  "token": "XXXXXXXXXXX",
  "phone_id": "1025821790609502",
  "business_id": "123456789"
}
```

### GET /api/config/whatsapp-meta
Buscar configuração WhatsApp

---

## 📊 Webhook Payloads

### WhatsApp Webhook
```
POST /api/whatsapp/webhook
Body:
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "metadata": {
          "phone_number_id": "1025821790609502"
        },
        "messages": [{
          "from": "5571981234567",
          "id": "wamid.xxx",
          "timestamp": "1774551930570",
          "text": {
            "body": "Olá"
          }
        }],
        "contacts": [{
          "profile": { "name": "João Silva" },
          "wa_id": "5571981234567"
        }]
      }
    }]
  }]
}
```

### Instagram Webhook
```
POST /api/instagram/webhook
Body:
{
  "object": "instagram",
  "entry": [{
    "time": 1774551931369,
    "id": "17841448115950083",
    "messaging": [{
      "sender": {
        "id": "2055366968346312",
        "username": "danmenezesfsa"
      },
      "recipient": {
        "id": "17841448115950083"
      },
      "timestamp": 1774551930570,
      "message": {
        "mid": "aWdfZAG1faXRlbToxOkl...",
        "text": "Olá!"
      }
    }]
  }]
}
```

---

## 📊 Dashboard v2 Endpoints (NEW)

### GET /api/dashboard/resumo
Retorna resumo geral com metas e KPIs

**Response:**
```json
{
  "meta_dia": { "valor": 5000, "realizado": 3200, "pct": 64 },
  "meta_semana": { "valor": 35000, "realizado": 18500, "pct": 53 },
  "meta_mes": { "valor": 150000, "realizado": 92000, "pct": 61 },
  "conversoes_hoje": 45,
  "taxa_conversao": 85,
  "ticket_medio": 850,
  "leads_pendentes": 12
}
```

### GET /api/dashboard/ranking-atendentes?periodo=mes
TOP 10 atendentes por pontos (dia|semana|mes|tudo)

**Response:**
```json
[
  { "posicao": 1, "id": 2, "nome": "João Silva", "pontos": 47, "vendas": 10, "valor_total": 8500 },
  { "posicao": 2, "id": 3, "nome": "Maria Santos", "pontos": 42, "vendas": 9, "valor_total": 7800 }
]
```

### GET /api/dashboard/grafico-conversoes
Dados para gráfico (últimos 7 dias)

### GET /api/dashboard/metas
Status de metas (dia/semana/mês)

---

## 💳 Pagamentos Endpoints (NEW)

### GET /api/pagamentos
Listar todos os pagamentos

### POST /api/pagamentos
Registrar pagamento de venda
```json
{ "venda_id": 123, "data_pagamento": "2026-03-27", "forma_pagamento": "PIX" }
```

### PUT /api/pagamentos/:id
Atualizar data de entrega de vídeo
```json
{ "data_entrega_video": "2026-03-30" }
```

---

## 🎥 Vídeos Endpoints (NEW)

### GET /api/videos
Listar vídeos

### POST /api/videos/enviar
Enviar vídeo e notificar cliente
```json
{ "venda_id": 123, "data_entrega": "2026-03-30", "tipo": "Padrão" }
```

---

## 👥 Indicações Endpoints (NEW)

### GET /api/indicacoes
Listar indicações

### POST /api/indicacoes
Registrar nova indicação
```json
{
  "venda_id_indicador": 123,
  "novo_cliente_nome": "João Silva",
  "novo_cliente_tel": "71981234567"
}
```

---

## 🎯 Metas Globais Endpoints (NEW)

### GET /api/metas-globais
Listar metas da empresa

### POST /api/metas-globais
Criar meta (admin/gestor)
```json
{ "periodo": "diaria|semanal|mensal", "valor_meta": 5000, "mes_ano": "2026-03-27" }
```

### PUT /api/metas-globais/:id
Atualizar meta

---

## 📅 Calendário Endpoint (NEW)

### GET /api/calendario
Eventos de pagamentos e vídeos

---

## 📈 Relatórios Endpoints (NEW)

### GET /api/relatorios/vendas-csv?periodo=mes
Export vendas em CSV

### GET /api/relatorios/desempenho
Relatório de desempenho de atendentes

---

## ⚠️ Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Server Error |

---

## 🔐 Rate Limiting

| Endpoint | Limite |
|----------|--------|
| /api/login | 20 req/15 min |
| /api/ia/resposta | 60 req/min |
| Outros /api | 300 req/min |

---

**Versão**: 1.0.0
**Última atualização**: 27/03/2026
