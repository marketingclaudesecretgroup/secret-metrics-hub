import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { persistentStorage } from '../engine/storage.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  domain: string;
  role: 'admin' | 'analyst';
  loginTime: number;
  expiresAt: number;
}

export interface OAuthStatePayload {
  nonce: string;
  returnTo: string;
  timestamp: number;
}

const COOKIE_NAME = 'sm_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutos para completar login

/**
 * Sanitiza URL de redirecionamento interno para prevenir ataques de Open Redirect
 */
export function sanitizeReturnUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '/';
  const trimmed = url.trim();
  // Deve iniciar com '/' e não com '//', '/\', ou esquemas como 'javascript:', 'https:'
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return trimmed;
  }
  return '/';
}

export class SessionManager {
  private secret: string;

  constructor() {
    this.secret = config.auth.sessionSecret;
  }

  createToken(user: AuthUser): string {
    const data = Buffer.from(JSON.stringify(user)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('base64url');
    return `${data}.${signature}`;
  }

  verifyToken(token: string): AuthUser | null {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;

    const [data, signature] = token.split('.');
    if (!data || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('base64url');

    const bufSig = Buffer.from(signature);
    const bufExpected = Buffer.from(expectedSignature);

    // Proteção contra falha de comprimento em crypto.timingSafeEqual
    if (bufSig.length !== bufExpected.length) {
      return null;
    }

    // Previne timing attacks
    if (!crypto.timingSafeEqual(bufSig, bufExpected)) {
      return null;
    }

    try {
      const json = Buffer.from(data, 'base64url').toString('utf8');
      const user: AuthUser = JSON.parse(json);

      if (!user || !user.email || typeof user.expiresAt !== 'number') {
        return null;
      }

      if (Date.now() > user.expiresAt) {
        return null;
      }

      return user;
    } catch {
      return null;
    }
  }

  /**
   * Gera token assinado anti-CSRF para o fluxo do Google OAuth2
   */
  createOAuthState(returnTo: string = '/'): string {
    const payload: OAuthStatePayload = {
      nonce: crypto.randomBytes(16).toString('hex'),
      returnTo: sanitizeReturnUrl(returnTo),
      timestamp: Date.now()
    };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`oauth_state:${data}`)
      .digest('base64url');
    return `${data}.${signature}`;
  }

  /**
   * Valida o token anti-CSRF retornado pelo Google OAuth2
   */
  verifyOAuthState(state: string): { valid: boolean; returnTo: string } {
    if (!state || typeof state !== 'string' || !state.includes('.')) {
      return { valid: false, returnTo: '/' };
    }

    const [data, signature] = state.split('.');
    if (!data || !signature) {
      return { valid: false, returnTo: '/' };
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(`oauth_state:${data}`)
      .digest('base64url');

    const bufSig = Buffer.from(signature);
    const bufExpected = Buffer.from(expectedSignature);

    if (bufSig.length !== bufExpected.length || !crypto.timingSafeEqual(bufSig, bufExpected)) {
      return { valid: false, returnTo: '/' };
    }

    try {
      const payload: OAuthStatePayload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
      if (Date.now() - payload.timestamp > OAUTH_STATE_TTL_MS) {
        return { valid: false, returnTo: '/' };
      }
      return { valid: true, returnTo: sanitizeReturnUrl(payload.returnTo) };
    } catch {
      return { valid: false, returnTo: '/' };
    }
  }

  setCookie(res: Response, user: AuthUser): void {
    const token = this.createToken(user);
    const isProd = config.nodeEnv === 'production';

    // Persiste a sessão no storage resiliente
    persistentStorage.saveSession(user.id, user);

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS
    });
  }

  clearCookie(res: Response, userId?: string): void {
    if (userId) {
      persistentStorage.deleteSession(userId);
    }
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      path: '/'
    });
  }

  getUserFromRequest(req: Request): AuthUser | null {
    // 1. Tenta extrair do cookie HTTP-only
    const cookieToken = req.cookies?.[COOKIE_NAME];
    if (cookieToken) {
      const user = this.verifyToken(cookieToken);
      if (user) return user;
    }

    // 2. Tenta extrair do header Authorization Bearer
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const bearerToken = authHeader.substring(7);
      const user = this.verifyToken(bearerToken);
      if (user) return user;
    }

    return null;
  }
}

export const sessionManager = new SessionManager();

/**
 * Middleware para proteger rotas da API
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = sessionManager.getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({
      error: 'Não autorizado',
      message: 'Acesso restrito ao time corporativo @secretoutlet.com.br. Faça login com sua conta Google Workspace.'
    });
  }

  (req as any).user = user;
  next();
}
