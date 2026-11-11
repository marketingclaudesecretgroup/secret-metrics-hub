import { Router, Request, Response } from 'express';
import { DataAggregator } from '../engine/aggregator.js';
import { LookerRequestPayload } from '../types/index.js';
import { apiKeyStore } from '../engine/keys.js';

export const lookerRouter = Router();
const aggregator = new DataAggregator();

/**
 * Health Check & Verificação do Conector Looker Studio
 */
lookerRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    service: 'Secret Metrics Looker Gateway',
    timestamp: new Date().toISOString()
  });
});

/**
 * Endpoint Oficial de Coleta de Dados para o Looker Studio Community Connector
 * Método: POST /api/looker/data
 */
lookerRouter.post('/data', async (req: Request, res: Response) => {
  try {
    const payload: LookerRequestPayload = req.body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload de requisição inválido.' });
    }

    // 1. Validação estrita da API Key do conector Looker Studio
    if (!payload.apiKey || typeof payload.apiKey !== 'string' || !apiKeyStore.isValidKey(payload.apiKey.trim())) {
      return res.status(401).json({
        error: 'Chave de API do conector não autorizada ou revogada.',
        hint: 'Gere uma chave ativa no portal da Secret Metrics.'
      });
    }

    // 2. Sanitização de Dataset (Whitelisting)
    const allowedDatasets = ['consolidated_mer', 'ecommerce_orders', 'paid_media', 'organic_traffic'];
    const dataset = allowedDatasets.includes(payload.dataset) ? payload.dataset : 'consolidated_mer';

    // 3. Sanitização de datas (formato numérico YYYYMMDD ou YYYY-MM-DD)
    const sanitizeDate = (val: any): string | undefined => {
      if (typeof val !== 'string') return undefined;
      const cleaned = val.replace(/[^0-9]/g, '');
      return cleaned.length === 8 ? cleaned : undefined;
    };

    const startDate = sanitizeDate(payload.dateRange?.startDate);
    const endDate = sanitizeDate(payload.dateRange?.endDate);
    const paidOnly = payload.orderStatusFilter === 'paid_only';

    let rows: any[] = [];

    switch (dataset) {
      case 'consolidated_mer':
        rows = await aggregator.getConsolidatedMER(startDate, endDate);
        break;

      case 'ecommerce_orders':
        rows = await aggregator.getAllOrders(startDate, endDate, paidOnly);
        break;

      case 'paid_media':
        rows = await aggregator.getAllMedia(startDate, endDate);
        break;

      case 'organic_traffic':
        rows = await aggregator.getOrganicData(startDate);
        break;

      default:
        rows = await aggregator.getConsolidatedMER(startDate, endDate);
    }

    // 4. Retorno seguro para o conector Looker Studio
    return res.json({
      success: true,
      count: rows.length,
      dataset,
      rows
    });
  } catch (error: any) {
    console.error('[LookerRouter] Erro ao processar requisição do Looker:', error);
    return res.status(500).json({
      error: 'Erro interno ao processar dados para o Looker Studio.',
      details: error.message
    });
  }
});
