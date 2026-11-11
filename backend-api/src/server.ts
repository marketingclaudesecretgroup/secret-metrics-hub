import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { portalRouter } from './routes/portal.js';
import { lookerRouter } from './routes/looker.js';
import { integrationsRouter } from './routes/integrations.js';
import { securityHeaders, createRateLimiter, appGatekeeper } from './middleware/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

const app = express();

// 1. Cabeçalhos de Segurança HTTP (OWASP / Hardening)
app.use(securityHeaders);

// 2. CORS restrito e credenciais para cookies seguros
app.use(cors({
  origin: true,
  credentials: true
}));

// 3. Parsers de Cookies e JSON
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// 4. Rate Limiters Específicos
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 40,
  message: 'Limite de tentativas de autenticação excedido. Aguarde 1 minuto.'
});

const lookerLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 180,
  message: 'Limite de requisições do conector Looker Studio atingido. Aguarde 1 minuto.'
});

// 5. Rotas de API
// Rotas de Autenticação Corporativa (Google Workspace OAuth2)
app.use('/api/auth', authLimiter, authRouter);

// Rotas Administrativas do Portal SaaS (Protegidas por Sessão Google Workspace)
app.use('/api/portal', portalRouter);

// Rotas do Conector Looker Studio (Protegidas por API Key)
app.use('/api/looker', lookerLimiter, lookerRouter);

// Rotas Legadas de Status dos Conectores
app.use('/api/integrations', integrationsRouter);

// 6. Gatekeeper de Navegação da Aplicação Web
// Intercepta '/' e '/index.html' antes de express.static para exigir autenticação estrita
app.use(appGatekeeper(publicDir));

// 7. Servir arquivos estáticos (CSS, JS, imagens, ícones) SEM index automático
app.use(express.static(publicDir, { index: false }));

app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 [Secret Metrics Hub] Plataforma online na porta ${config.port}`);
  console.log(`🔒 Gatekeeper de Acesso: Ativo (Redirecionamento para /login)`);
  console.log(`🌐 Portal Web & Login:   http://localhost:${config.port}/login`);
  console.log(`📊 Endpoint Looker:       http://localhost:${config.port}/api/looker/data`);
  console.log(`🛡️ Auth Google Workspace: Domínio @${config.auth.allowedDomains.join(', @')}`);
  console.log(`=======================================================`);
});
