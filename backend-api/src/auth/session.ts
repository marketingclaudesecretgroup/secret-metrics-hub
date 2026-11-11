import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

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

const COOKIE_NAME = 'sm_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

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
    if (!token || !token.includes('.')) return null;

    const [data, signature] = token.split('.');
    if (!data || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('base64url');

    // Previne timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    try {
      const json = Buffer.from(data, 'base64url').toString('utf8');
      const user: AuthUser = JSON.parse(json);

      if (Date.now() > user.expiresAt) {
        return null;
      }

      return user;
    } catch {
      return null;
    }
  }

  setCookie(res: Response, user: AuthUser): void {
    const token = this.createToken(user);
    const isProd = config.nodeEnv === 'production';

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS
    });
  }

  clearCookie(res: Response): void {
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
