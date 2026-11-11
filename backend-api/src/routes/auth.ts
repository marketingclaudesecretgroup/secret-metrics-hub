import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config.js';
import { sessionManager, AuthUser } from '../auth/session.js';

export const authRouter = Router();

/**
 * Retorna o status de autenticação da sessão atual
 */
authRouter.get('/me', (req: Request, res: Response) => {
  const user = sessionManager.getUserFromRequest(req);
  if (!user) {
    return res.json({
      authenticated: false,
      user: null
    });
  }

  return res.json({
    authenticated: true,
    user
  });
});

/**
 * Gera a URL oficial de consentimento do Google Workspace OAuth2
 */
authRouter.get('/google/url', (req: Request, res: Response) => {
  const { googleClientId, googleRedirectUri } = config.auth;

  if (!googleClientId) {
    return res.status(400).json({
      error: 'GOOGLE_CLIENT_ID não configurado no servidor.',
      devLoginAvailable: config.auth.devLoginEnabled
    });
  }

  // Define redirect URI completo
  const protocol = req.protocol;
  const host = req.get('host') || `localhost:${config.port}`;
  const redirectUri = googleRedirectUri.startsWith('http')
    ? googleRedirectUri
    : `${protocol}://${host}${googleRedirectUri}`;

  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    hd: 'secretoutlet.com.br', // Filtra visualmente no Google para o domínio corporativo
    access_type: 'online',
    prompt: 'select_account'
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return res.json({
    authUrl,
    allowedDomains: config.auth.allowedDomains
  });
});

/**
 * Callback do Google OAuth2
 */
authRouter.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error || !code) {
    console.error('[Google OAuth] Erro ou cancelamento:', error);
    return res.redirect(`/?auth_error=${encodeURIComponent(error || 'missing_code')}`);
  }

  try {
    const protocol = req.protocol;
    const host = req.get('host') || `localhost:${config.port}`;
    const redirectUri = config.auth.googleRedirectUri.startsWith('http')
      ? config.auth.googleRedirectUri
      : `${protocol}://${host}${config.auth.googleRedirectUri}`;

    // 1. Troca code por tokens no Google
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: config.auth.googleClientId,
        client_secret: config.auth.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token } = tokenResponse.data;

    // 2. Busca informações do perfil do usuário
    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const googleUser = userResponse.data;
    const email: string = (googleUser.email || '').toLowerCase();
    const domain = email.split('@')[1] || '';

    // 3. Validação estrita do domínio corporativo ou lista de e-mails autorizados
    const isDomainAllowed = config.auth.allowedDomains.includes(domain);
    const isEmailAllowed = config.auth.allowedEmails.includes(email);

    if (!isDomainAllowed && !isEmailAllowed) {
      console.warn(`[Google OAuth] Acesso negado para: ${email}. Domínio não autorizado: @${domain}`);
      return res.redirect(`/?auth_error=unauthorized_domain&email=${encodeURIComponent(email)}`);
    }

    // 4. Criação da sessão corporativa segura
    const user: AuthUser = {
      id: googleUser.sub || `usr_${Date.now()}`,
      email,
      name: googleUser.name || email.split('@')[0],
      picture: googleUser.picture,
      domain,
      role: email.includes('admin') || email.includes('diretoria') ? 'admin' : 'analyst',
      loginTime: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 dias
    };

    sessionManager.setCookie(res, user);
    console.log(`[Google OAuth] Login bem-sucedido: ${email} (${user.role})`);

    return res.redirect('/?auth=success');
  } catch (err: any) {
    console.error('[Google OAuth] Falha no fluxo OAuth:', err.response?.data || err.message);
    return res.redirect(`/?auth_error=oauth_failed`);
  }
});

/**
 * Login corporativo de desenvolvimento/demonstração
 * Permite simulação segura do acesso corporativo @secretoutlet.com.br
 */
authRouter.post('/dev-login', (req: Request, res: Response) => {
  if (!config.auth.devLoginEnabled) {
    return res.status(403).json({
      error: 'Dev login desabilitado em ambiente de produção estrita.'
    });
  }

  const role = req.body.role === 'analyst' ? 'analyst' : 'admin';
  const email = req.body.email || (role === 'admin' ? 'admin@secretoutlet.com.br' : 'growth@secretoutlet.com.br');
  const name = req.body.name || (role === 'admin' ? 'Secret Outlet Admin' : 'Growth & Performance Team');

  const user: AuthUser = {
    id: `dev_${Date.now()}`,
    email,
    name,
    picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    domain: 'secretoutlet.com.br',
    role,
    loginTime: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
  };

  sessionManager.setCookie(res, user);

  return res.json({
    success: true,
    message: 'Login corporativo ativo com sucesso.',
    user
  });
});

/**
 * Logout corporativo (limpa o cookie de sessão)
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  sessionManager.clearCookie(res);
  return res.json({
    success: true,
    message: 'Sessão encerrada com segurança.'
  });
});
