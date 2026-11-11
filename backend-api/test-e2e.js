import http from 'http';
import axios from 'axios';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4005;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log('🧪 [Test Suite] Iniciando servidor de teste na porta ' + PORT + '...');

  const serverProcess = spawn('node', ['dist/server.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: PORT.toString(),
      NODE_ENV: 'test',
      DEV_LOGIN_ENABLED: 'true'
    },
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', (d) => {
    // console.log(`[SERVER]: ${d}`);
  });
  serverProcess.stderr.on('data', (d) => {
    console.error(`[SERVER ERR]: ${d}`);
  });

  // Aguarda servidor iniciar
  await new Promise((resolve) => setTimeout(resolve, 2000));

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    const client = axios.create({
      baseURL: BASE_URL,
      validateStatus: () => true, // Permite checar status codes como 302, 401
      maxRedirects: 0 // Não segue redirects automaticamente para validar os status 302
    });

    console.log('\n--- 1. TESTE DO GATEKEEPER DE PÁGINAS ---');

    // 1. Acesso a / sem autenticação deve redirecionar para /login (HTTP 302)
    const resHomeUnauth = await client.get('/');
    assert(resHomeUnauth.status === 302, 'Não autenticado em / retorna HTTP 302');
    assert(resHomeUnauth.headers.location === '/login', 'Redirecionamento aponta para /login');

    // 2. Acesso a /index.html sem autenticação deve redirecionar para /login
    const resIndexUnauth = await client.get('/index.html');
    assert(resIndexUnauth.status === 302, 'Não autenticado em /index.html retorna HTTP 302');
    assert(resIndexUnauth.headers.location === '/login', 'Redirecionamento aponta para /login');

    // 3. Acesso a /login sem autenticação entrega a nova página de Login (HTTP 200)
    const resLoginUnauth = await client.get('/login');
    assert(resLoginUnauth.status === 200, 'Acesso a /login retorna HTTP 200');
    assert(resLoginUnauth.data.includes('Secret Outlet Metrics'), 'Página contém branding da Secret Outlet');
    assert(resLoginUnauth.data.includes('Entrar com Google Workspace'), 'Página contém botão oficial do Google');
    assert(resLoginUnauth.data.includes('@secretoutlet.com.br'), 'Página indica restrição corporativa');

    console.log('\n--- 2. TESTE DE CABEÇALHOS DE SEGURANÇA (HARDENING) ---');
    assert(resLoginUnauth.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff presente');
    assert(resLoginUnauth.headers['x-frame-options'] === 'SAMEORIGIN', 'X-Frame-Options: SAMEORIGIN presente');
    assert(resLoginUnauth.headers['x-xss-protection'] === '1; mode=block', 'X-XSS-Protection presente');
    assert(resLoginUnauth.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Referrer-Policy seguro');
    assert(!!resLoginUnauth.headers['content-security-policy'], 'Content-Security-Policy (CSP) ativo');

    console.log('\n--- 3. TESTE DE PROTEÇÃO DE ROTAS DE API DO PORTAL ---');
    // Chamada deslogada em /api/portal/overview deve retornar 401
    const resOverviewUnauth = await client.get('/api/portal/overview');
    assert(resOverviewUnauth.status === 401, 'Acesso não autenticado a /api/portal/overview retorna 401');

    console.log('\n--- 4. TESTE DO CONECTOR LOOKER STUDIO COM API KEY ---');
    // 1. Health check do Looker
    const resLookerHealth = await client.get('/api/looker/health');
    assert(resLookerHealth.status === 200, '/api/looker/health retorna 200');
    assert(resLookerHealth.data.status === 'online', 'Looker status é "online"');

    // 2. Chamada sem API Key
    const resLookerNoKey = await client.post('/api/looker/data', { dataset: 'consolidated_mer' });
    assert(resLookerNoKey.status === 401, 'Chamada sem API Key no Looker retorna 401');

    // 3. Chamada com Master API Key válida (dataset consolidated_mer)
    const masterApiKey = 'secret-outlet-looker-token-2026';
    const resLookerMer = await client.post('/api/looker/data', {
      apiKey: masterApiKey,
      dataset: 'consolidated_mer',
      dateRange: { startDate: '20261101', endDate: '20261111' },
      fields: ['date', 'mer', 'realRoas', 'approvedRevenue', 'totalAdSpend']
    });
    assert(resLookerMer.status === 200, 'Looker /data retorna 200 com API Key autorizada');
    assert(resLookerMer.data.dataset === 'consolidated_mer', 'Dataset retornado é consolidated_mer');
    assert(resLookerMer.data.rows.length > 0, 'Retorna linhas de métricas consolidadas');
    assert(typeof resLookerMer.data.rows[0].mer === 'number', 'Métrica MER calculada numericamente');

    // 4. Chamada com dataset paid_media (testando reportedRoas adicionado)
    const resLookerMedia = await client.post('/api/looker/data', {
      apiKey: masterApiKey,
      dataset: 'paid_media',
      dateRange: { startDate: '20261101', endDate: '20261111' },
      fields: ['adPlatform', 'campaignName', 'spend', 'reportedRoas']
    });
    assert(resLookerMedia.status === 200, 'Dataset paid_media retorna 200');
    assert(typeof resLookerMedia.data.rows[0].reportedRoas === 'number', 'reportedRoas está calculado e formatado');

    console.log('\n--- 5. TESTE DE AUTENTICAÇÃO E SESSÃO CORPORATIVA (DEV LOGIN & COOKIE) ---');
    // Login com dev-login
    const resDevLogin = await client.post('/api/auth/dev-login', { role: 'admin' });
    assert(resDevLogin.status === 200, 'POST /api/auth/dev-login retorna 200');
    assert(resDevLogin.data.success === true, 'Login dev bem-sucedido');
    assert(resDevLogin.data.user.domain === 'secretoutlet.com.br', 'Domínio corporativo validado');

    // Extrai o cookie sm_session retornado
    const cookies = resDevLogin.headers['set-cookie'];
    assert(Array.isArray(cookies) && cookies.some(c => c.includes('sm_session=')), 'Cookie sm_session emitido pelo servidor');
    const sessionCookie = cookies.find(c => c.includes('sm_session=')).split(';')[0];

    const authHeaders = {
      Cookie: sessionCookie
    };

    // Checa /api/auth/me com o cookie
    const resMe = await client.get('/api/auth/me', { headers: authHeaders });
    assert(resMe.status === 200, '/api/auth/me retorna 200');
    assert(resMe.data.authenticated === true, 'Sessão reportada como authenticated: true');
    assert(resMe.data.user.email === 'admin@secretoutlet.com.br', 'Email do usuário confere');

    // Acesso a / COM cookie de sessão agora entrega o dashboard index.html (HTTP 200)
    const resHomeAuth = await client.get('/', { headers: authHeaders });
    assert(resHomeAuth.status === 200, 'Acesso autenticado a / retorna 200 OK');
    assert(resHomeAuth.data.includes('Performance Unificada de Vendas & Mídia'), 'Dashboard principal é entregue com sucesso');

    // Acesso a /login COM cookie de sessão redireciona para / (HTTP 302)
    const resLoginAuth = await client.get('/login', { headers: authHeaders });
    assert(resLoginAuth.status === 302, 'Usuário autenticado em /login recebe 302');
    assert(resLoginAuth.headers.location === '/', 'Redireciona autenticado de volta para /');

    // Acesso a /api/portal/overview autenticado
    const resOverviewAuth = await client.get('/api/portal/overview', { headers: authHeaders });
    assert(resOverviewAuth.status === 200, 'Acesso autenticado a /api/portal/overview retorna 200');
    assert(typeof resOverviewAuth.data.kpis.mer === 'number', 'KPIs retornados com precisão');

    console.log('\n--- 6. TESTE DE PREVENÇÃO DE OPEN REDIRECT ---');
    // Tentativa de redirecionamento para domínio externo malicioso
    const resOpenRedirect1 = await client.post('/api/auth/dev-login', {
      role: 'admin',
      returnTo: 'https://evil-attacker.com'
    });
    assert(resOpenRedirect1.data.redirect === '/', 'Open redirect "https://evil-attacker.com" neutralizado para "/"');

    const resOpenRedirect2 = await client.post('/api/auth/dev-login', {
      role: 'admin',
      returnTo: '//malicious-site.com'
    });
    assert(resOpenRedirect2.data.redirect === '/', 'Open redirect "//malicious-site.com" neutralizado para "/"');

    console.log('\n--- 7. TESTE DE PROTEÇÃO CSRF NO GOOGLE OAUTH STATE ---');
    // State gerado pelo servidor
    const resGoogleUrl = await client.get('/api/auth/google/url?returnTo=/connectors');
    assert(resGoogleUrl.status === 200, '/api/auth/google/url retorna 200');
    assert(!!resGoogleUrl.data.state, 'State criptograficamente assinado emitido');

    // Tentativa de callback com state adulterado/falsificado
    const resCallbackForged = await client.get('/api/auth/google/callback?code=fake_code&state=tampered.fake_signature');
    assert(resCallbackForged.status === 302, 'Callback com state inválido redireciona com 302');
    assert(resCallbackForged.headers.location === '/login?auth_error=invalid_state', 'Bloqueio CSRF com erro invalid_state');

    console.log('\n--- 8. TESTE DA CAMADA DE PERSISTÊNCIA ROBUSTA (STORAGE LAYER) ---');
    // 1. Cria uma nova chave pelo portal autenticado
    const keyName = 'Chave Persistente E2E Test ' + Date.now();
    const resCreateKey = await client.post('/api/portal/keys', { name: keyName }, { headers: authHeaders });
    assert(resCreateKey.status === 200, 'POST /api/portal/keys retorna 200');
    assert(resCreateKey.data.success === true, 'Chave criada com sucesso no portal');
    const newApiKey = resCreateKey.data.key.key;
    const newKeyId = resCreateKey.data.key.id;
    assert(!!newApiKey && newApiKey.startsWith('so_live_'), 'Formato da chave é válido (so_live_...)');

    // 2. Inspeciona o arquivo data/storage.json diretamente no disco
    const storageFilePath = path.join(__dirname, 'data', 'storage.json');
    assert(fs.existsSync(storageFilePath), 'Arquivo data/storage.json existe no disco físico');
    const storageRaw = fs.readFileSync(storageFilePath, 'utf8');
    const storageParsed = JSON.parse(storageRaw);
    assert(!!storageParsed.keys[newApiKey], 'Nova chave persistida imediatamente no arquivo data/storage.json');
    assert(storageParsed.keys[newApiKey].name === keyName, 'Nome da chave coincide no arquivo persistente');
    assert(!!storageParsed.keys['secret-outlet-looker-token-2026'], 'Master API Key preservada no storage persistente');

    // 3. Valida que a nova chave funciona para consultas no Looker Studio
    const resLookerWithNewKey = await client.post('/api/looker/data', {
      apiKey: newApiKey,
      dataset: 'consolidated_mer',
      dateRange: { startDate: '20261101', endDate: '20261111' },
      fields: ['date', 'mer']
    });
    assert(resLookerWithNewKey.status === 200, 'Looker aceita a chave recém-criada');
    assert(resLookerWithNewKey.data.rows.length > 0, 'Retorna linhas de métricas com a nova chave');

    // 4. Revoga a chave e verifica que deixa de funcionar
    const resRevoke = await client.delete(`/api/portal/keys/${newKeyId}`, { headers: authHeaders });
    assert(resRevoke.status === 200, 'DELETE /api/portal/keys/:id retorna 200');
    
    // Consulta Looker com a chave revogada deve ser rejeitada
    const resLookerRevoked = await client.post('/api/looker/data', {
      apiKey: newApiKey,
      dataset: 'consolidated_mer'
    });
    assert(resLookerRevoked.status === 401, 'Looker rejeita chave revogada com 401 Unauthorized');

    console.log('\n--- 9. TESTE DE WEBHOOKS EM TEMPO REAL (SHOPIFY & BAGY) ---');
    // 1. Webhook Shopify Order
    const resShopifyWebhook = await client.post('/api/webhooks/shopify/orders', {
      id: 99123841,
      order_number: 1088,
      total_price: '489.90',
      financial_status: 'paid',
      customer: { email: 'cliente.vip@secretoutlet.com.br' },
      line_items: [{ title: 'Camiseta Osklen', price: '249.90' }, { title: 'Bermuda Reserva', price: '240.00' }]
    }, {
      headers: {
        'x-webhook-test-mode': 'true',
        'x-shopify-topic': 'orders/paid',
        'Content-Type': 'application/json'
      }
    });
    assert(resShopifyWebhook.status === 200, 'POST /api/webhooks/shopify/orders retorna 200');
    assert(resShopifyWebhook.data.success === true, 'Webhook Shopify reporta success: true');
    assert(resShopifyWebhook.data.cacheInvalidated === true, 'Invalidação imediata de cache confirmada');
    assert(resShopifyWebhook.data.platform === 'shopify', 'Plataforma identificada como shopify');

    // 2. Webhook Bagy Order
    const resBagyWebhook = await client.post('/api/webhooks/bagy/orders', {
      id: 54321,
      total: '320.00',
      status: 'paid',
      customer: { name: 'Cliente Bagy Express' }
    }, {
      headers: {
        'x-webhook-test-mode': 'true',
        'Content-Type': 'application/json'
      }
    });
    assert(resBagyWebhook.status === 200, 'POST /api/webhooks/bagy/orders retorna 200');
    assert(resBagyWebhook.data.cacheInvalidated === true, 'Invalidação de cache confirmada na Bagy');
    assert(resBagyWebhook.data.platform === 'bagy', 'Plataforma identificada como bagy');

    // 3. Simulador de Webhook via Portal SaaS
    const resSimulateWebhook = await client.post('/api/portal/webhooks/simulate', {
      platform: 'shopify',
      amount: 389.00
    }, { headers: authHeaders });
    assert(resSimulateWebhook.status === 200, 'POST /api/portal/webhooks/simulate retorna 200');
    assert(resSimulateWebhook.data.cacheInvalidated === true, 'Simulação valida renovação de cache');

    console.log('\n--- 10. TESTE DA TRILHA DE AUDITORIA & COMPLIANCE ---');
    // 1. Busca logs da trilha de auditoria
    const resAudit = await client.get('/api/portal/audit-logs', { headers: authHeaders });
    assert(resAudit.status === 200, 'GET /api/portal/audit-logs retorna 200');
    assert(resAudit.data.success === true, 'Auditoria reporta success: true');
    assert(Array.isArray(resAudit.data.logs), 'Retorna lista de logs');
    assert(resAudit.data.total > 0, 'Total de logs maior que zero');

    // 2. Valida que a consulta do Looker foi registrada com latência e status
    const lookerLog = resAudit.data.logs.find(l => l.action === 'looker_query');
    assert(!!lookerLog, 'Consulta do Looker Studio registrada na trilha de auditoria');
    assert(lookerLog && typeof lookerLog.latencyMs === 'number', 'Latência de execução gravada no log');

    // 3. Valida que os webhooks foram registrados na trilha de auditoria
    const webhookLog = resAudit.data.logs.find(l => l.category === 'WEBHOOK');
    assert(!!webhookLog, 'Webhook registrado na trilha de auditoria');
    assert(webhookLog && webhookLog.status === 'SUCCESS', 'Status do webhook registrado como SUCCESS');

    // 4. Valida que criação e revogação de chaves foram auditadas
    const keyLog = resAudit.data.logs.find(l => l.action === 'key_created');
    assert(!!keyLog, 'Ação de criação de chave auditada com identificador do ator');

    // 5. Teste de filtro por categoria
    const resAuditFilter = await client.get('/api/portal/audit-logs?category=SECURITY', { headers: authHeaders });
    assert(resAuditFilter.status === 200, 'Filtro por categoria SECURITY retorna 200');
    assert(resAuditFilter.data.logs.every(l => l.category === 'SECURITY'), 'Todos os logs filtrados pertencem a SECURITY');

    console.log('\n--- 11. TESTE DO MOTOR DE MONITORAMENTO & ALERTAS DE ANOMALIA ---');
    // 1. Busca alertas e diagnósticos de saúde
    const resAlerts = await client.get('/api/portal/alerts', { headers: authHeaders });
    assert(resAlerts.status === 200, 'GET /api/portal/alerts retorna 200');
    assert(resAlerts.data.success === true, 'Avaliação de saúde executada');
    assert(['HEALTHY', 'ATTENTION', 'CRITICAL'].includes(resAlerts.data.status), 'Status global é HEALTHY, ATTENTION ou CRITICAL');
    assert(typeof resAlerts.data.score === 'number', 'Score numérico de saúde de 0 a 100 calculado');
    assert(Array.isArray(resAlerts.data.alerts), 'Lista de alertas retornada como array');
    assert(typeof resAlerts.data.metrics.mer === 'number', 'Métrica MER avaliada pelo motor');
    assert(typeof resAlerts.data.metrics.blendedCpa === 'number', 'Métrica Blended CPA avaliada');
    assert(typeof resAlerts.data.metrics.approvalRate === 'number', 'Métrica Taxa de Aprovação avaliada');

    // 2. Reconhecimento de alerta se houver algum
    if (resAlerts.data.alerts.length > 0) {
      const firstAlertId = resAlerts.data.alerts[0].id;
      const resAck = await client.post(`/api/portal/alerts/${firstAlertId}/ack`, {}, { headers: authHeaders });
      assert(resAck.status === 200, 'POST /api/portal/alerts/:id/ack retorna 200');
      assert(resAck.data.success === true, 'Alerta reconhecido com sucesso');
    } else {
      console.log('  ℹ️ Nenhum alerta anômalo pendente (operação 100% saudável)');
    }

    console.log('\n--- 12. TESTE DE LOGOUT CORPORATIVO ---');
    const resLogout = await client.post('/api/auth/logout', {}, { headers: authHeaders });
    assert(resLogout.status === 200, '/api/auth/logout retorna 200');
    assert(resLogout.data.redirect === '/login', 'Resposta de logout indica redirecionamento para /login');

    const logoutCookies = resLogout.headers['set-cookie'];
    assert(logoutCookies && logoutCookies.some(c => c.includes('sm_session=;') || c.includes('Max-Age=0')), 'Cookie de sessão sm_session foi limpo');

    console.log('\n=======================================');
    console.log(`🎯 TOTAL DE TESTES: ${passed + failed}`);
    console.log(`✅ APROVADOS: ${passed}`);
    console.log(`❌ FALHAS: ${failed}`);
    console.log('=======================================');

  } catch (err) {
    console.error('Erro na execução dos testes:', err);
    failed++;
  } finally {
    serverProcess.kill();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
