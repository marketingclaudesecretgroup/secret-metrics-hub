import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { sessionManager, sanitizeReturnUrl } from '../auth/session.js';
import { config } from '../config.js';

/**
 * Middleware para aplicação de cabeçalhos de segurança HTTP essenciais (OWASP Best Practices)
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Previne sniffing de MIME types pelo navegador
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Proteção contra Clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Proteção XSS legada ativa
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Política estrita de Referrer
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Desativa permissões sensíveis não utilizadas
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // HSTS em ambiente de produção
  if (config.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy refinada para suportar Tailwind CDN, Google Fonts e APIs
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://*.googleapis.com",
    "frame-ancestors 'self'"
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  next();
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

/**
 * Rate Limiter in-memory ultra-leve baseado em janela deslizante (Sliding Window)
 * com limpeza periódica para evitar memory leak.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, maxRequests, message = 'Muitas requisições. Tente novamente mais tarde.' } = options;
  const requestsMap = new Map<string, number[]>();

  // Limpeza de IPs inativos a cada ciclo
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of requestsMap.entries()) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) {
        requestsMap.delete(key);
      } else {
        requestsMap.set(key, valid);
      }
    }
  }, Math.max(windowMs, 30000));

  // Não segura o event loop do Node no shutdown
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : (req.ip || req.socket.remoteAddress || 'unknown_ip');

    const key = `${req.baseUrl || ''}_${clientIp}`;
    const now = Date.now();

    const timestamps = (requestsMap.get(key) || []).filter(t => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000).toString());
      return res.status(429).json({
        error: 'Too Many Requests',
        message
      });
    }

    timestamps.push(now);
    requestsMap.set(key, timestamps);
    next();
  };
}

/**
 * Gatekeeper da Aplicação Web:
 * - Se o usuário NÃO estiver autenticado e tentar acessar '/', '/index.html' ou qualquer área interna,
 *   é redirecionado compulsoriamente para '/login'.
 * - Se o usuário JÁ estiver autenticado e tentar acessar '/login' ou '/login.html',
 *   é redirecionado para o Dashboard principal '/'.
 */
export function appGatekeeper(publicDir: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Ignora requisições de API
    if (req.path.startsWith('/api/')) {
      return next();
    }

    const user = sessionManager.getUserFromRequest(req);
    const isAuthenticated = !!user;

    // 2. Rota de Login (/login ou /login.html)
    if (req.path === '/login' || req.path === '/login.html') {
      if (isAuthenticated) {
        return res.redirect('/');
      }
      return res.sendFile(path.join(publicDir, 'login.html'));
    }

    // 3. Permite acesso a arquivos estáticos com extensões explícitas (exceto .html)
    if (req.path.match(/\.(css|js|svg|png|jpg|jpeg|gif|ico|webp|woff2?|map|txt|json)$/i)) {
      return next();
    }

    // 4. Todas as rotas de Dashboard ou SPA:
    // Se não autenticado -> redireciona para /login
    if (!isAuthenticated) {
      const returnParam = req.originalUrl && req.originalUrl !== '/' && req.originalUrl !== '/index.html'
        ? `?returnTo=${encodeURIComponent(sanitizeReturnUrl(req.originalUrl))}`
        : '';
      return res.redirect(`/login${returnParam}`);
    }

    // Se autenticado -> entrega o Dashboard
    return res.sendFile(path.join(publicDir, 'index.html'));
  };
}
