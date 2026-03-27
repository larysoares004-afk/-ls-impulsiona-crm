# 🎯 LS IMPULSIONA CRM

**Sistema de Atendimento Integrado para WhatsApp, Instagram e Formulários**

---

## 🚀 Status

- ✅ **Código**: Duplicado e pronto
- ✅ **Banco de dados**: Vazio (sem dados da Alliance)
- ✅ **Branding**: Atualizado para LS Impulsiona
- ✅ **Git**: Novo repositório criado
- ⏳ **Deploy**: Pronto para Railway

---

## 📋 O que está incluído:

### Backend (Node.js + Express)
- ✅ WhatsApp Cloud API (Meta)
- ✅ Instagram Direct Messages (Meta)
- ✅ Integração com N8N para IA automática
- ✅ Sistema de leads/formulários
- ✅ Gestão de atendimentos
- ✅ JWT Authentication
- ✅ Rate limiting e segurança

### Frontend (HTML/CSS/JS)
- ✅ Dashboard de atendimentos
- ✅ Chat com WhatsApp/Instagram
- ✅ Sistema de transferência de conversas
- ✅ Notificações em tempo real
- ✅ Gestão de leads convertidos
- ✅ Configurações integradas

### Banco de dados (SQLite)
- ✅ Conversas WhatsApp
- ✅ Mensagens Instagram
- ✅ Histórico de leads
- ✅ Usuários e permissões
- ✅ Configurações de integração

---

## 🔐 Isolamento de Dados

**Nenhum dado da Alliance está aqui!**

```
Alliance CRM          LS Impulsiona CRM
├─ alliance.db        ├─ ls-impulsiona.db
├─ /api/...           ├─ /api/...
└─ railway.app        └─ railway.app (novo)
```

Cada sistema tem seu próprio:
- 📦 Banco de dados
- 🌐 URL/domínio
- 🔑 Chaves de API
- 👥 Usuários
- 💬 Conversas

---

## 📖 Documentação

Veja `SETUP_LSIMPULSIONA.md` para:
- Passos de deployment no Railway
- Configuração de WhatsApp/Instagram
- Integração com N8N
- Trocar credenciais padrão

---

## 🎯 Fluxo de uso:

1. **Cliente manda mensagem** → WhatsApp, Instagram ou formulário
2. **CRM recebe** → Salva no banco
3. **Atendente ve** → Na aba de Atendimentos
4. **Responde** → Via WhatsApp/Instagram integrado
5. **IA pode ajudar** → Via N8N automáticamente

---

## 💡 Próximas modificações:

Você pode agora:
- ✏️ Mudar cores/logo
- ✏️ Adicionar novos campos
- ✏️ Criar novos relatórios
- ✏️ Integrar com suas APIs
- ✏️ Customizar o workflow

Tudo **sem afetar a Alliance**!

---

## 📧 Contato

Feito por: **Laryssa - LS Impulsiona**
