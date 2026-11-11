import crypto from 'crypto';
import { config } from '../config.js';
import { persistentStorage } from './storage.js';

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
  listKeys(): ApiKeyRecord[] {
    const keys = persistentStorage.getAllKeys();
    return keys.map(k => ({
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

    persistentStorage.saveKey(record);
    return record;
  }

  revokeKey(keyOrId: string): boolean {
    return persistentStorage.revokeKey(keyOrId);
  }

  isValidKey(candidateKey: string): boolean {
    if (!candidateKey) return false;
    
    // Master key direto do config
    if (candidateKey === config.masterApiKey) {
      persistentStorage.recordKeyUsage(candidateKey);
      return true;
    }

    const record = persistentStorage.getKeyByValue(candidateKey);
    if (!record) return false;
    if (record.status !== 'active') return false;

    // Registra uso no storage persistente
    persistentStorage.recordKeyUsage(candidateKey);
    return true;
  }

  getKeyDetails(candidateKey: string): ApiKeyRecord | undefined {
    return persistentStorage.getKeyByValue(candidateKey);
  }
}

export const apiKeyStore = new ApiKeyStore();
