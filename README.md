<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />

# 🚀 Multi Gestor PRO
### Sistema Multinegócios SaaS — Gestão de Cobranças, Clientes, IPTV, Empréstimos e WhatsApp Automático

[![AI Studio](https://img.shields.io/badge/Google%20AI%20Studio-Applet%20Ready-blue?logo=google)](https://ai.studio/apps/386f0ff0-e3f1-409a-b4f0-ec17ea7e9a25)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-purple?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

## 🌟 Visualizar e Executar no Google AI Studio

Você pode abrir, testar e editar este projeto diretamente no Google AI Studio:

👉 **[Abrir no Google AI Studio](https://ai.studio/apps/386f0ff0-e3f1-409a-b4f0-ec17ea7e9a25)**

---

## 📋 Sobre o Multi Gestor PRO

O **Multi Gestor PRO** é uma plataforma SaaS multitenant modular desenvolvida para gerenciar diferentes verticais de negócios em um único painel administrativo centralizado:

- 📺 **IPTV & Streaming:** Gestão de assinantes, servidores, testes grátis, planos e vencimentos.
- 💰 **Empréstimos & Cobranças:** Gestão de contratos, parcelas, juros, comprovantes e status de inadimplência.
- 🔄 **Assinaturas Recorrentes:** Controle de serviços mensais/anuais com renovação automática.
- 🏢 **Negócios & Empresas:** Gestão de clientes comerciais, faturas, produtos e vendas.
- 📱 **Automação WhatsApp (Engine Nativo Baileys):**
  - Conexão direta por QR Code por tenant (isolamento completo de instâncias).
  - Persistência das sessões e credenciais no banco PostgreSQL do Supabase.
  - Agendador diário com envio automático de avisos (1 dia antes, no dia do vencimento e em atraso).
  - Regra anti-duplicação inteligente com simulação de digitação humana (anti-ban).
- 💳 **Checkout PIX Automático:** Integração completa com Mercado Pago (criação de QR Code PIX e aprovação instantânea via webhook/polling).
- ☁️ **Sincronização em Nuvem:** Suporte nativo ao Supabase PostgreSQL com fallback local resiliente.

---

## 💻 Executar Localmente

### Pré-requisitos
- **Node.js** (versão 18 ou superior)
- **npm** ou **yarn**

### 1. Clonar o repositório
```bash
git clone https://github.com/Bambamtelas/multi-gestor.git
cd multi-gestor
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
Copie o arquivo de exemplo `.env.example` para `.env`:
```bash
cp .env.example .env
```

Preencha as variáveis conforme necessário:
```env
PORT=3000
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon-publica
MERCADO_PAGO_ACCESS_TOKEN=seu-token-mercado-pago
```

### 4. Iniciar o servidor de desenvolvimento
```bash
npm run dev
```

Abra no navegador em: **`http://localhost:3000`**

---

## 🛠️ Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor backend com middleware do Vite para desenvolvimento com HMR |
| `npm run build` | Compila o frontend React/Vite para a pasta `dist` otimizada para produção |
| `npm start` | Inicia o servidor Express em modo de produção servindo os estáticos compilados |
| `npm run lint` | Executa a verificação estática de tipos do TypeScript (`tsc --noEmit`) |
| `npm run clean` | Remove as pastas `dist` e artefatos de compilação anteriores |

---

## 🚀 Deploy em Produção (Render / Vercel / VPS)

### Deploy no Render:
O projeto já conta com o arquivo [`render.yaml`](render.yaml) configurado:
- **Build Command:** `npm install --legacy-peer-deps && npm run build`
- **Start Command:** `npm start`
- **Ambiente:** `Node.js`

### Deploy no Vercel:
Arquivo [`vercel.json`](vercel.json) pré-configurado para roteamento SPA e APIs serverless.

---

## 📄 Licença

Este projeto está sob a licença [MIT](LICENSE).
