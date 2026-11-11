# 🚀 Guia de Implantação: Conector Looker Studio (Secret Metrics)

Este conector permite conectar seus dashboards do **Google Looker Studio** diretamente à sua **API própria**, consolidando:
- **E-commerce**: Bagy e Shopify (Secret Outlet)
- **Mídia Paga**: Google Ads, Meta Ads e Criteo Ads
- **Orgânico & Web**: Google Analytics 4 (GA4) e Google Search Console

---

## Passo a Passo para Instalar no Google Looker Studio

### 1. Criar o Projeto no Google Apps Script
1. Acesse: [script.google.com](https://script.google.com/)
2. Clique em **Novo projeto**.
3. Renomeie o projeto no topo para: `Secret Metrics - Looker Connector`.

### 2. Ativar o Arquivo de Manifesto (`appsscript.json`)
1. No menu lateral esquerdo do Apps Script, clique no ícone de engrenagem ⚙️ (**Configurações do Projeto**).
2. Marque a opção: **"Exibir arquivo de manifesto 'appsscript.json' no editor"**.
3. Volte para o Editor de Código (`< >`).
4. Abra o arquivo `appsscript.json` que apareceu e substitua todo o conteúdo pelo conteúdo do arquivo `appsscript.json` desta pasta.

### 3. Inserir o Código do Conector (`Code.js`)
1. No arquivo `Código.gs` (ou `Code.js`), apague o conteúdo existente.
2. Cole todo o código contido no arquivo `Code.js` desta pasta.
3. Clique em **Salvar** (ícone de disquete ou `Ctrl + S`).

### 4. Configurar a URL da sua API Backend
No arquivo `Code.js`, por padrão a URL apontada é a sua API.
Para produção ou desenvolvimento com túnel (ngrok / Cloudflare Tunnel / servidor na nuvem):
1. No menu ⚙️ **Configurações do Projeto**, vá até **Propriedades do script**.
2. Adicione a propriedade:
   - **Propriedade**: `API_BASE_URL`
   - **Valor**: `https://sua-api.seudominio.com.br/api/looker` (ou a URL pública do seu backend).

---

### 5. Fazer a Implantação (Deploy) no Looker Studio
1. No canto superior direito do Apps Script, clique no botão azul **Implantar** > **Nova implantação**.
2. Clique no ícone de engrenagem ao lado de "Selecione o tipo" e escolha **Conector do Looker Studio** (ou *Looker Studio Community Connector*).
3. Preencha a descrição (ex: `v1.0.0 - Secret Outlet Hub`).
4. Clique em **Implantar**.
5. O Google vai exibir uma tela com o link direto:
   - Exemplo: `https://lookerstudio.google.com/datasources/create?connectorId=AKfycbx...`

---

### 6. Como Conectar no Looker Studio
1. Abra o link gerado acima no seu navegador.
2. O Looker Studio solicitará sua **Chave de API**.
   - Digite sua chave mestre (definida no `.env` do backend: `secret-outlet-looker-token-2026`).
3. Selecione o Dataset desejado:
   - **Consolidado**: E-commerce + Mídia (MER & ROAS Real)
   - **E-commerce Secret Outlet**: Pedidos Unificados (Bagy + Shopify)
   - **Mídia Paga Unificada**: Google + Meta + Criteo
   - **Tráfego Orgânico**: GA4 + Search Console
4. Clique em **Conectar** no canto superior direito.
5. Pronto! Todas as dimensões e métricas estarão prontas para arrastar e soltar nos gráficos do Looker Studio.
