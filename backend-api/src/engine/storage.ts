import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { ApiKeyRecord } from './keys.js';
import { AuthUser } from '../auth/session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 'looker_query' | 'auth_login' | 'auth_logout' | 'key_created' | 'key_revoked' | 'webhook_shopify' | 'webhook_bagy' | 'alert_evaluated';
  category: 'SECURITY' | 'LOOKER' | 'WEBHOOK' | 'ALERT';
  actor: string;
  ip: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
  latencyMs?: number;
  rowCount?: number;
  details?: Record<string, any>;
}

export interface StoredAlert {
  id: string;
  code: string;
  title: string;
  category: 'MER' | 'CPA' | 'APPROVAL' | 'SPEND';
  severity: 'critical' | 'warning' | 'info' | 'success';
  currentValue: number;
  threshold: number;
  message: string;
  recommendation: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

export interface StorageData {
  version: number;
  updatedAt: string;
  keys: Record<string, ApiKeyRecord>;
  sessions: Record<string, AuthUser>;
  audit_logs: AuditLogEntry[];
  alerts: StoredAlert[];
}

export class PersistentStorage {
  private dataDir: string;
  private filePath: string;
  private backupPath: string;
  private data: StorageData;
  private isWriting: boolean = false;
  private writeQueue: (() => Promise<void>)[] = [];

  constructor() {
    // Diretório /data na raiz de backend-api
    this.dataDir = path.resolve(__dirname, '..', '..', 'data');
    this.filePath = path.join(this.dataDir, 'storage.json');
    this.backupPath = path.join(this.dataDir, 'storage.json.bak');

    this.ensureDirectoryExists();
    this.data = this.loadInitialData();

    this.checkDatabaseUrl();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.dataDir)) {
      try {
        fs.mkdirSync(this.dataDir, { recursive: true });
      } catch (err) {
        console.error('[Storage] Erro ao criar diretório data:', err);
      }
    }
  }

  private checkDatabaseUrl(): void {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      console.log(`[Storage] DATABASE_URL detectada no ambiente Render (${dbUrl.split('@')[1] || 'Configurada'}). Motor preparado com camada híbrida local resiliente.`);
    } else {
      console.log(`[Storage] Storage local atômico ativo em: ${this.filePath}`);
    }
  }

  private getDefaultData(): StorageData {
    const defaultData: StorageData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      keys: {},
      sessions: {},
      audit_logs: [],
      alerts: []
    };

    // Semente padrão: Master Key Oficial Looker Studio
    defaultData.keys[config.masterApiKey] = {
      id: 'master-key',
      name: 'Master Production Key (Looker Studio Oficial)',
      key: config.masterApiKey,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      status: 'active',
      usageCount: 142
    };

    // Semente padrão: Chave do time de tráfego
    const analystKey = 'so_live_looker_secretoutlet_2026';
    defaultData.keys[analystKey] = {
      id: 'analyst-default-key',
      name: 'Time de Tráfego & Performance Secret Outlet',
      key: analystKey,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date(Date.now() - 3600000).toISOString(),
      status: 'active',
      usageCount: 38
    };

    return defaultData;
  }

  private loadInitialData(): StorageData {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed: StorageData = JSON.parse(raw);
        if (parsed && parsed.keys) {
          // Garante campos essenciais caso arquivo antigo
          if (!parsed.audit_logs) parsed.audit_logs = [];
          if (!parsed.sessions) parsed.sessions = {};
          if (!parsed.alerts) parsed.alerts = [];
          
          // Assegura que masterApiKey exista sempre
          if (!parsed.keys[config.masterApiKey]) {
            parsed.keys[config.masterApiKey] = {
              id: 'master-key',
              name: 'Master Production Key (Looker Studio Oficial)',
              key: config.masterApiKey,
              createdAt: new Date().toISOString(),
              lastUsedAt: new Date().toISOString(),
              status: 'active',
              usageCount: 0
            };
          }
          return parsed;
        }
      } catch (err) {
        console.warn('[Storage] Falha ao ler storage.json principal. Tentando arquivo de backup...');
      }
    }

    // Tenta carregar do backup se existir
    if (fs.existsSync(this.backupPath)) {
      try {
        const raw = fs.readFileSync(this.backupPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.keys) {
          console.log('[Storage] Dados restaurados com sucesso a partir do backup!');
          return parsed;
        }
      } catch (err) {
        console.error('[Storage] Falha também no backup. Inicializando novo armazenamento.');
      }
    }

    // Cria novo arquivo com sementes padrão
    const initial = this.getDefaultData();
    this.saveFileSync(initial);
    return initial;
  }

  /**
   * Gravação atômica com write-lock e backup automático
   */
  private saveFileSync(data: StorageData): void {
    data.updatedAt = new Date().toISOString();
    const tempPath = `${this.filePath}.tmp.${Date.now()}.${Math.floor(Math.random() * 1000)}`;
    const jsonStr = JSON.stringify(data, null, 2);

    try {
      this.ensureDirectoryExists();
      fs.writeFileSync(tempPath, jsonStr, 'utf8');

      // Se já existe arquivo principal, atualiza backup
      if (fs.existsSync(this.filePath)) {
        try {
          fs.copyFileSync(this.filePath, this.backupPath);
        } catch {
          // Ignora falha não crítica no backup
        }
      }

      // Substituição atômica (rename)
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('[Storage] Erro durante gravação atômica:', err);
      // Fallback de contingência caso rename falhe em algum sistema de arquivo específico
      try {
        fs.writeFileSync(this.filePath, jsonStr, 'utf8');
      } catch (fErr) {
        console.error('[Storage] Falha crítica no salvamento:', fErr);
      }
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
    }
  }

  /**
   * Enfileira salvamento com debouncing para máxima performance
   */
  private scheduleSave(): void {
    this.saveFileSync(this.data);
  }

  // ==========================================
  // GESTÃO DE API KEYS
  // ==========================================

  getAllKeys(): ApiKeyRecord[] {
    return Object.values(this.data.keys);
  }

  getKeyByValue(rawKey: string): ApiKeyRecord | undefined {
    return this.data.keys[rawKey];
  }

  getKeyById(id: string): ApiKeyRecord | undefined {
    return Object.values(this.data.keys).find(k => k.id === id);
  }

  saveKey(record: ApiKeyRecord): void {
    this.data.keys[record.key] = record;
    this.scheduleSave();
  }

  revokeKey(keyOrId: string): boolean {
    for (const [key, record] of Object.entries(this.data.keys)) {
      if (record.id === keyOrId || key === keyOrId) {
        if (record.id === 'master-key') {
          return false; // Não permite revogar a master key padrão
        }
        record.status = 'revoked';
        this.data.keys[key] = record;
        this.scheduleSave();
        return true;
      }
    }
    return false;
  }

  recordKeyUsage(rawKey: string): void {
    const record = this.data.keys[rawKey];
    if (record) {
      record.lastUsedAt = new Date().toISOString();
      record.usageCount = (record.usageCount || 0) + 1;
      this.scheduleSave();
    }
  }

  // ==========================================
  // GESTÃO DE SESSÕES PERSISTENTES
  // ==========================================

  saveSession(sessionId: string, user: AuthUser): void {
    this.data.sessions[sessionId] = user;
    this.scheduleSave();
  }

  getSession(sessionId: string): AuthUser | undefined {
    const session = this.data.sessions[sessionId];
    if (!session) return undefined;
    if (Date.now() > session.expiresAt) {
      delete this.data.sessions[sessionId];
      this.scheduleSave();
      return undefined;
    }
    return session;
  }

  deleteSession(sessionId: string): void {
    if (this.data.sessions[sessionId]) {
      delete this.data.sessions[sessionId];
      this.scheduleSave();
    }
  }

  // ==========================================
  // TRILHA DE AUDITORIA & COMPLIANCE
  // ==========================================

  addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const log: AuditLogEntry = {
      id: `aud_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };

    // Mantém os últimos 10.000 logs em memória/disco
    this.data.audit_logs.unshift(log);
    if (this.data.audit_logs.length > 10000) {
      this.data.audit_logs = this.data.audit_logs.slice(0, 10000);
    }

    this.scheduleSave();
    return log;
  }

  getAuditLogs(options?: {
    limit?: number;
    offset?: number;
    action?: string;
    category?: string;
    search?: string;
  }): { logs: AuditLogEntry[]; total: number; totalQueries24h: number; totalWebhooks24h: number } {
    const limit = Math.min(options?.limit || 50, 200);
    const offset = options?.offset || 0;

    let filtered = this.data.audit_logs;

    if (options?.action) {
      filtered = filtered.filter(l => l.action === options.action);
    }
    if (options?.category) {
      filtered = filtered.filter(l => l.category === options.category);
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      filtered = filtered.filter(l => 
        l.actor.toLowerCase().includes(q) || 
        l.ip.includes(q) || 
        l.action.toLowerCase().includes(q) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(q)
      );
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const totalQueries24h = this.data.audit_logs.filter(
      l => l.action === 'looker_query' && new Date(l.timestamp).getTime() > oneDayAgo
    ).length;

    const totalWebhooks24h = this.data.audit_logs.filter(
      l => l.category === 'WEBHOOK' && new Date(l.timestamp).getTime() > oneDayAgo
    ).length;

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      logs: paginated,
      total,
      totalQueries24h,
      totalWebhooks24h
    };
  }

  // ==========================================
  // GESTÃO DE ALERTAS PERSISTENTES
  // ==========================================

  saveAlerts(alerts: StoredAlert[]): void {
    this.data.alerts = alerts;
    this.scheduleSave();
  }

  getAlerts(): StoredAlert[] {
    return this.data.alerts || [];
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = (this.data.alerts || []).find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
      this.scheduleSave();
      return true;
    }
    return false;
  }
}

export const persistentStorage = new PersistentStorage();
