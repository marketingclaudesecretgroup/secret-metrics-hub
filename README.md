# ⚡ Secret Metrics Hub — Plataforma Omnichannel & Conector Looker Studio

Plataforma unificada estilo **Supermetrics**, desenvolvida sob medida para a **Secret Outlet**, integrando **E-commerce (Shopify & Bagy)** com **Tráfego Pago (Google Ads, Meta Ads e Criteo Ads)** e **Orgânico (GA4 & Search Console)** diretamente para o **Google Looker Studio**, com segurança corporativa **Google Workspace OAuth2**, portal SaaS moderno estilo Linear/Dark Glass e suporte nativo a deploy no **Render** e **Docker**.

---

## 🌟 Principais Recursos

1. **Segurança Corporativa Google Workspace (SSO)**:
   - Login restrito por padrão a contas `@secretoutlet.com.br` e e-mails autorizados.
   - Tokens de sessão assinados com criptografia HMAC-SHA256 em cookies `HTTP-only` seguros com flag `SameSite=Lax`.
   - Proteção de rotas no portal administrativo e endpoints da API (`/api/portal/*`).
   - Modo de desenvolvimento / demonstração corporativa (`/api/auth/dev-login`) para validação rápida local e offline.

2. **Portal Web SaaS Completo (Linear Dark Glass Aesthetic)**:
   - **Visão Geral**: Dashboard com KPIs ao vivo (MER 5.82x, ROAS Real, Receita Aprovada, Gasto Total em Mídia, CPA Blended, Taxa de Aprovação), gráfico de barras de tendência diária e divisão de investimento por canal.
   - **Conectores & Status**: Monitoramento em tempo real dos 7 conectores (Shopify, Bagy, Google Ads, Meta Ads, Criteo, GA4, GSC) com **botão de teste ao vivo** que mede a latência em milissegundos e valida respostas das APIs com feedback visual imediato.
   - **Central Looker Studio**:
     - Botão de instalação em 1 clique no Google Looker Studio.
     - Gerenciador completo de chaves de API do conector (geração de novas chaves, cópia em 1 clique, contagem de requisições, revogação).
     - Visualizador interativo de schema com todas as dimensões, métricas e fórmulas de cálculo para 4 datasets.
     - Testador de query em tempo real com alternância instantânea entre exibição em Tabela de Dados e JSON Raw formatado.
   - **Templates de Relatórios**: 4 modelos prontos para o Looker Studio (Executivo C-Level & MER, Mídia Paga 360°, Auditor de E-commerce, SEO & Tráfego Orgânico) com pré-visualização e link direto.

3. **Pronto para Deploy no Render & GitHub**:
   - `render.yaml`: Blueprint Infrastructure-as-Code completo com build command, start command, health check `/api/looker/health` e variáveis de ambiente tipadas.
   - `Dockerfile`: Imagem multi-stage ultra-otimizada em Alpine Linux, com compilação TypeScript, usuário seguro não-root `node` e healthcheck embutido.
   - `.gitignore` & `.dockerignore`: Limpos e estritos, garantindo zero vazamento de segredos, chaves `.env` ou credenciais locais.

---

## 🏗️ Estrutura do Repositório

```
Super_metrics/
├── render.yaml                     # Blueprint oficial de deploy no Render
├── Dockerfile                      # Multi-stage production Docker container
├── .dockerignore                   # Exclusões seguras para o Docker build
├── .gitignore                      # Proteção completa contra vazamento de segredos
├── README.md                       # Documentação técnica e operacional
│
├── backend-api/                    # API Hub & Servidor Web (Node.js + TypeScript + Express)
│   ├── src/
│   │   ├── auth/
│   │   │   └── session.ts          # Gerenciador de sessão HMAC, cookies HTTP-only e middleware requireAuth
│   │   ├── connectors/             # Coletores e normalizadores de dados
│   │   │   ├── shopify.ts          # Pedidos e transações Shopify Secret Outlet
│   │   │   ├── bagy.ts             # Pedidos e carrinhos Bagy E-commerce
│   │   │   ├── metaAds.ts          # Métricas da Graph API Meta Ads
│   │   │   ├── googleAds.ts        # Performance da Google Ads API v17
│   │   │   ├── criteoAds.ts        # Retargeting da Criteo Marketing API
│   │   │   └── ga4.ts              # Google Analytics 4 & Search Console
│   │   ├── engine/
│   │   │   ├── aggregator.ts       # Cálculo de MER, ROAS Real, Blended CPA e Aprovação
│   │   │   ├── cache.ts            # Camada de cache em memória de alta performance
│   │   │   └── keys.ts             # Gestão segura e validação de chaves de API Looker
│   │   ├── routes/
│   │   │   ├── auth.ts             # Google Workspace OAuth2 & Dev Login
│   │   │   ├── portal.ts           # Endpoints administrativos do portal (KPIs, testes, schema, chaves)
│   │   │   ├── looker.ts           # Endpoint oficial POST /api/looker/data para o conector
│   │   │   └── integrations.ts     # Status das plataformas
│   │   ├── config.ts               # Central de variáveis de ambiente tipadas
│   │   └── server.ts               # Servidor Express com rotas e middleware
│   ├── public/
│   │   └── index.html              # Interface Web SaaS Dark Glass completa
│   ├── .env.example                # Template seguro de variáveis de ambiente
│   ├── package.json
│   └── tsconfig.json
│
└── looker-connector/               # Conector Oficial do Google Looker Studio
    ├── appsscript.json             # Manifesto de implantação do Apps Script
    ├── Code.js                     # Implementação dos métodos getAuthType, getConfig, getSchema, getData
    └── README.md                   # Guia passo a passo de publicação no Apps Script
```

---

## 🎯 Métricas Exclusivas Calculadas

1. **MER (Marketing Efficiency Ratio)**:
   $$\text{MER} = \frac{\text{Receita Total Aprovada (Shopify + Bagy)}}{\text{Gasto Total de Mídia (Google + Meta + Criteo)}}$$
2. **ROAS Real Omnichannel**: Cruza os pedidos efetivamente compensados (PIX + Cartão) contra os custos de mídia reportados, eliminando sobreposições e viés de canais.
3. **CPA Blended**:
   $$\text{Blended CPA} = \frac{\text{Investimento Total de Marketing}}{\text{Total de Pedidos Faturados}}$$
4. **Taxa de Pagamento / Aprovação**:
   $$\text{Taxa de Aprovação} = \frac{\text{Pedidos com Pagamento Confirmado}}{\text{Total de Pedidos Gerados}} \times 100$$

---

## 🚀 Como Executar Localmente

### 1. Pré-requisitos
- Node.js 20+ ou 22+
- npm 10+

### 2. Configuração do Ambiente
```bash
cd backend-api
cp .env.example .env
npm install
```

### 3. Compilação & Inicialização
```bash
# Compilar TypeScript
npm run build

# Iniciar servidor em modo produção
npm start

# Ou em modo desenvolvimento com auto-reload
npm run dev
```

Acesse:
- **Portal Web & Hub**: [http://localhost:4000](http://localhost:4000)
- **Endpoint do Conector Looker**: [http://localhost:4000/api/looker/data](http://localhost:4000/api/looker/data)
- **Health Check**: [http://localhost:4000/api/looker/health](http://localhost:4000/api/looker/health)

---

## 🌐 Deploy no Render em 1 Clique

O repositório já inclui o arquivo `render.yaml` pronto para o **Render Blueprints**.

1. Crie uma conta ou faça login no [Render](https://render.com).
2. Conecte sua conta do GitHub ao Render.
3. Vá em **Blueprints** > **New Blueprint Instance**.
4. Selecione este repositório (`Super_metrics`).
5. O Render detectará automaticamente o arquivo `render.yaml` e provisionará o Web Service `secret-metrics-hub`.
6. Preencha as credenciais secretas no painel do Render (ou utilize os valores simulados iniciais).

---

## 🐳 Execução via Docker

Para rodar o container de produção localmente:

```bash
# Na raiz do repositório
docker build -t secret-metrics-hub .

# Executar container na porta 4000
docker run -p 4000:4000 --env-file backend-api/.env secret-metrics-hub
```

---

## 🔒 Configuração do Google Workspace OAuth2

Para ativar o Login Corporativo Oficial via Google Workspace:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com).
2. Vá em **APIs & Serviços** > **Credenciais** > **Criar Credenciais** > **ID do cliente OAuth**.
3. Selecione o tipo de aplicativo **Aplicativo da Web**.
4. Adicione os **URIs de redirecionamento autorizados**:
   - Desenvolvimento: `http://localhost:4000/api/auth/google/callback`
   - Produção no Render: `https://seu-app.onrender.com/api/auth/google/callback`
5. Copie o `Client ID` e o `Client Secret` para o arquivo `.env` ou variáveis de ambiente do Render:
   ```env
   GOOGLE_CLIENT_ID=seu_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=seu_client_secret
   ALLOWED_GOOGLE_DOMAINS=secretoutlet.com.br
   ```
6. O sistema bloqueará automaticamente qualquer tentativa de login que não pertença ao domínio `@secretoutlet.com.br` ou aos e-mails explicitamente autorizados em `ALLOWED_GOOGLE_EMAILS`.

---

## 📊 Configuração no Google Looker Studio

Consulte o passo a passo completo no arquivo [`looker-connector/README.md`](looker-connector/README.md) para publicar o conector na sua conta corporativa do Google Apps Script e vincular aos dashboards da Secret Outlet.
