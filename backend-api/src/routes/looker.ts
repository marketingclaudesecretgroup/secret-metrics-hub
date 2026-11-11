import { Router, Request, Response } from 'express';
import { DataAggregator } from '../engine/aggregator.js';
import { LookerRequestPayload } from '../types/index.js';
import { apiKeyStore } from '../engine/keys.js';

export const lookerRouter = Router();
const aggregator = new DataAggregator();

/**
 * Health Check & Verificação do Conector
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

    // Validação da API Key do conector Looker Studio
    if (!payload.apiKey || !apiKeyStore.isValidKey(payload.apiKey)) {
      return res.status(401).json({ error: 'Chave de API do conector não autorizada ou revogada.' });
    }

    const { dataset, dateRange, orderStatusFilter, fields } = payload;
    const startDate = dateRange?.startDate;
    const endDate = dateRange?.endDate;

    let rows: any[] = [];

    switch (dataset) {
      case 'consolidated_mer':
        rows = await aggregator.getConsolidatedMER(startDate, endDate);
        break;

      case 'ecommerce_orders':
        const paidOnly = orderStatusFilter === 'paid_only';
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

    // Retorna linhas para o conector formatar
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
