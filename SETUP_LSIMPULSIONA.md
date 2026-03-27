# 🚀 LS IMPULSIONA CRM - Guia de Deploy e Configuração

## ✅ O que foi feito:

- ✅ Projeto duplicado completamente (sem dados da Alliance)
- ✅ Banco de dados **vazio e limpo**
- ✅ Branding atualizado para **LS Impulsiona**
- ✅ Novo repositório Git criado
- ✅ Pronto para deploy **independente** no Railway

---

## 📂 Localização do projeto:
```
C:\Users\larys\Downloads\ls-impulsiona-crm\
```

---

## 🔧 PRÓXIMOS PASSOS:

### 1️⃣ Criar repositório no GitHub (para LS Impulsiona)

```bash
cd C:\Users\larys\Downloads\ls-impulsiona-crm
git remote add origin https://github.com/SEU_USERNAME/ls-impulsiona-crm.git
git branch -M main
git push -u origin main
```

### 2️⃣ Deploy no Railway

**Opção A: Via Railway Dashboard**
1. Acesse: https://railway.app
2. Clique em "New Project"
3. Selecione "GitHub repo"
4. Conecte o repositório `ls-impulsiona-crm`
5. Railway detecta automaticamente o Dockerfile
6. Deploy automático! 🚀

**Opção B: Via Railway CLI**
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### 3️⃣ Configurar variáveis de ambiente

No Railway Dashboard, adicione:
```
NODE_ENV=production
PORT=8080
JWT_SECRET=LS_IMPULSIONA_JWT_SECRET_2024
N8N_WEBHOOK_URL=(deixar vazio por enquanto)
```

### 4️⃣ WhatsApp & Instagram (configurar dentro do CRM)

Após o deploy, entre no CRM com:
- **Email**: `lary@lsimpulsiona.com`
- **Senha**: `admin123` (trocar depois!)

Configure:
- WhatsApp Token (Meta Cloud API)
- Instagram Token (se usar)
- N8N Webhook (para IA)

---

## 📊 Credenciais Padrão (trocar no primeiro acesso!)

```
Admin:      lary / admin123
Gestor:     gestor / gestor123
Atendente:  atend / atend123
Vendedor:   vend / vend123
```

---

## 🔒 Dados Isolados

**Alliance CRM:**
- Banco: `/data/alliance.db`
- URL: `https://alliance-crm-production.up.railway.app`

**LS Impulsiona CRM:**
- Banco: `/data/ls-impulsiona.db` (vazio)
- URL: `https://ls-impulsiona-crm.up.railway.app` (após deploy)

✅ **Completamente separados — mudanças em um não afetam o outro!**

---

## 📝 Checklist pré-deploy:

- [ ] Repositório criado no GitHub
- [ ] Git remote adicionado
- [ ] Primeira branch enviada para GitHub
- [ ] Projeto importado no Railway
- [ ] Variáveis de ambiente configuradas
- [ ] Build completo (Railway vai fazer automaticamente)
- [ ] Acessar a URL do Railway e logar

---

## 🆘 Dúvidas comuns:

**P: Posso modificar o LS Impulsiona sem afetar Alliance?**
✅ **Sim!** São repositórios, bancos de dados e deployments diferentes.

**P: Como sincronizar mudanças futuras da Alliance para LS?**
Você terá que fazer manualmente:
```bash
git remote add alliance https://github.com/.../alliance-crm.git
git pull alliance main (e resolver conflitos)
```

**P: Preciso dos dados da Alliance?**
❌ **Não.** O banco está **completamente vazio**. Você começa do zero.

**P: Como resetar o banco de dados?**
No Railway Dashboard → Data → Remova o volume `/data` e rode o deploy de novo.

---

## 🎉 Pronto!

Você agora tem um CRM **100% independente** para LS Impulsiona!
