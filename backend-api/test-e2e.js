import http from 'http';
import axios from 'axios';
import { spawn } from 'child_process';
import path from 'path';
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

    console.log('\n--- 8. TESTE DE LOGOUT CORPORATIVO ---');
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
