import crypto from 'crypto';
import { config } from '../config.js';

export interface ApiKeyRecord {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsedAt?: string;
  status: 'active' | 'revoked';
  usageCount: number;
}

class ApiKeyStore {
  private keys: Map<string, ApiKeyRecord> = new Map();

  constructor() {
    // Registra a Master API Key padrão
    this.keys.set(config.masterApiKey, {
      id: 'master-key',
      name: 'Master Production Key (Looker Studio Oficial)',
      key: config.masterApiKey,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      status: 'active',
      usageCount: 142
    });

    // Registra uma chave para analistas de marketing
    const analystKey = 'so_live_looker_secretoutlet_2026';
    this.keys.set(analystKey, {
      id: 'analyst-default-key',
      name: 'Time de Tráfego & Performance Secret Outlet',
      key: analystKey,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date(Date.now() - 3600000).toISOString(),
      status: 'active',
      usageCount: 38
    });
  }

  listKeys(): ApiKeyRecord[] {
    return Array.from(this.keys.values()).map(k => ({
      ...k,
      // Mascara parte da chave para segurança visual no portal
      key: k.key.length > 12 ? `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}` : k.key,
      fullKey: k.key
    } as any));
  }

  createKey(name: string): ApiKeyRecord {
    const rawKey = `so_live_${crypto.randomBytes(16).toString('hex')}`;
    const record: ApiKeyRecord = {
      id: `key_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: name.trim() || 'Nova Chave Looker Studio',
      key: rawKey,
      createdAt: new Date().toISOString(),
      status: 'active',
      usageCount: 0
    };

    this.keys.set(rawKey, record);
    return record;
  }

  revokeKey(keyOrId: string): boolean {
    for (const [key, record] of this.keys.entries()) {
      if (record.id === keyOrId || key === keyOrId) {
        if (record.id === 'master-key') {
          return false; // Não permite revogar a master key padrão
        }
        record.status = 'revoked';
        this.keys.set(key, record);
        return true;
      }
    }
    return false;
  }

  isValidKey(candidateKey: string): boolean {
    if (!candidateKey) return false;
    if (candidateKey === config.masterApiKey) return true;

    const record = this.keys.get(candidateKey);
    if (!record) return false;
    if (record.status !== 'active') return false;

    // Registra uso
    record.lastUsedAt = new Date().toISOString();
    record.usageCount += 1;
    return true;
  }
}

export const apiKeyStore = new ApiKeyStore();
