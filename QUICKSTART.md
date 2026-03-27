# ⚡ QUICKSTART - 30 MINUTOS PARA COMEÇAR

## 🎯 Objetivo
Ter o CRM rodando localmente e conectado ao WhatsApp em 30 minutos.

---

## ✅ Pré-requisitos (5 min)

- [ ] Node.js 18+ instalado (`node --version`)
- [ ] Git instalado
- [ ] Conta GitHub
- [ ] Conta Railway.app
- [ ] Conta Meta (Facebook/Instagram)

---

## 🚀 Fase 1: Setup Local (10 min)

### 1. Clone o projeto:
```bash
git clone https://github.com/SEU_USERNAME/ls-impulsiona-crm.git
cd ls-impulsiona-crm
```

### 2. Instale dependências:
```bash
npm install
```

### 3. Crie arquivo `.env`:
```bash
cat > .env << 'ENVEOF'
NODE_ENV=development
PORT=8080
JWT_SECRET=LS_IMPULSIONA_SECRET_2024
ENVEOF
```

### 4. Inicie o servidor:
```bash
npm start
```

### 5. Acesse:
```
http://localhost:8080
```

**Login padrão:**
- Email: `lary`
- Senha: `admin123`

---

## 📱 Fase 2: Conectar WhatsApp (10 min)

### 1. Obter credenciais Meta:
1. Vá em https://developers.facebook.com
2. Crie um app tipo "Business"
3. Adicione produto WhatsApp
4. Copie:
   - **Token**: WhatsApp → API Access
   - **Phone ID**: WhatsApp → Phone Numbers
   - **Business ID**: Configurações → Informações da conta

### 2. No CRM:
1. Vá em **Configurações** → **WhatsApp**
2. Cole os 3 valores
3. Clique **Salvar**
4. Status deve ficar verde ✅

### 3. Testar:
1. Envie mensagem do seu WhatsApp para o número configurado
2. Deve aparecer em **Atendimentos** em segundos
3. Responda pelo CRM
4. Mensagem deve chegar no WhatsApp

---

## 📸 Fase 3: Conectar Instagram (5 min)

### 1. Gerar token Instagram:
1. No Meta App Manager
2. Instagram → Configuração da API
3. Clique **"Gerar token"**
4. Autorize e copie o token

### 2. No CRM:
1. Vá em **Configurações** → **Instagram**
2. Cole o token
3. Business ID é preenchido automaticamente
4. Clique **Salvar**

### 3. Testar:
1. Envie DM para sua conta Instagram
2. Deve aparecer em **Atendimentos** > **Instagram**

---

## 🎉 Pronto!

Você tem:
- ✅ CRM rodando localmente
- ✅ WhatsApp conectado
- ✅ Instagram conectado
- ✅ Pronto para responder mensagens

---

## 📚 Próximos Passos

1. **Deploy no Railway** (veja SETUP_LSIMPULSIONA.md)
2. **Integrar N8N com IA** (veja DOCS_COMPLETA.md)
3. **Configurar formulários de leads**
4. **Treinar atendentes**

---

## 🆘 Problemas Comuns

### "npm: command not found"
→ Instale Node.js: https://nodejs.org

### "Port 8080 already in use"
→ Mude em `.env`: `PORT=3000`

### "Mensagens não chegam"
→ Verifique se o webhook está correto no Meta
→ Veja logs: `npm start` deve mostrar as requisições

### "Erro de autenticação"
→ Verifique token do WhatsApp/Instagram
→ Gere um novo token no Meta

---

## 📋 Checklist Final

- [ ] Node.js instalado
- [ ] Projeto clonado
- [ ] npm install executado
- [ ] .env criado
- [ ] Servidor rodando em localhost:8080
- [ ] Login funciona
- [ ] WhatsApp token salvo
- [ ] Primeira mensagem chegou
- [ ] Instagram token salvo
- [ ] Primeira DM chegou
- [ ] Conseguiu responder

---

**Tempo estimado**: 30 minutos
**Status**: ✅ Production Ready
**Próximo**: Deploy no Railway
