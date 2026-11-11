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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// Servir frontend do Portal Web
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Rotas de Autenticação Corporativa (Google Workspace OAuth2)
app.use('/api/auth', authRouter);

// Rotas Administrativas do Portal SaaS (Protegidas por Sessão Google)
app.use('/api/portal', portalRouter);

// Rotas do Conector Looker Studio (Protegidas por API Key)
app.use('/api/looker', lookerRouter);

// Rotas Legadas de Status dos Conectores
app.use('/api/integrations', integrationsRouter);

// Fallback SPA
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 [Secret Metrics Hub] Plataforma online na porta ${config.port}`);
  console.log(`🌐 Portal Web & Login: http://localhost:${config.port}`);
  console.log(`📊 Endpoint Looker:     http://localhost:${config.port}/api/looker/data`);
  console.log(`🔒 Auth Google:         Domínio @${config.auth.allowedDomains.join(', @')}`);
  console.log(`=======================================================`);
});
