import { ShopifyConnector } from '../connectors/shopify.js';
import { BagyConnector } from '../connectors/bagy.js';
import { MetaAdsConnector } from '../connectors/metaAds.js';
import { GoogleAdsConnector } from '../connectors/googleAds.js';
import { CriteoAdsConnector } from '../connectors/criteoAds.js';
import { OrganicAnalyticsConnector } from '../connectors/ga4.js';
import { globalCache } from './cache.js';
import { ConsolidatedMERRow, UnifiedOrder, AdPerformanceRow } from '../types/index.js';

export class DataAggregator {
  private shopify = new ShopifyConnector();
  private bagy = new BagyConnector();
  private meta = new MetaAdsConnector();
  private google = new GoogleAdsConnector();
  private criteo = new CriteoAdsConnector();
  private organic = new OrganicAnalyticsConnector();

  /**
   * Consolida Vendas da Secret Outlet (Bagy + Shopify)
   */
  async getAllOrders(startDate?: string, endDate?: string, paidOnly: boolean = false): Promise<UnifiedOrder[]> {
    const cacheKey = `orders_${startDate}_${endDate}_${paidOnly}`;
    const cached = globalCache.get<UnifiedOrder[]>(cacheKey);
    if (cached) return cached;

    const [shopifyOrders, bagyOrders] = await Promise.all([
      this.shopify.fetchOrders(startDate, endDate),
      this.bagy.fetchOrders(startDate, endDate)
    ]);

    let combined = [...shopifyOrders, ...bagyOrders];

    if (paidOnly) {
      combined = combined.filter(o => o.orderStatus === 'paid');
    }

    globalCache.set(cacheKey, combined, 180); // 3 minutos de cache
    return combined;
  }

  /**
   * Consolida Gastos de Mídia Paga (Google, Meta, Criteo)
   */
  async getAllMedia(startDate?: string, endDate?: string): Promise<AdPerformanceRow[]> {
    const cacheKey = `media_${startDate}_${endDate}`;
    const cached = globalCache.get<AdPerformanceRow[]>(cacheKey);
    if (cached) return cached;

    const [metaData, googleData, criteoData] = await Promise.all([
      this.meta.fetchPerformance(startDate, endDate),
      this.google.fetchPerformance(startDate, endDate),
      this.criteo.fetchPerformance(startDate, endDate)
    ]);

    const combined = [...metaData, ...googleData, ...criteoData];
    globalCache.set(cacheKey, combined, 180);
    return combined;
  }

  /**
   * Consolida o Dataset Principal: MER & ROAS Real diário
   * Cruzamento direto entre faturamento real (Shopify + Bagy) e investimento de tráfego pago
   */
  async getConsolidatedMER(startDate?: string, endDate?: string): Promise<ConsolidatedMERRow[]> {
    const cacheKey = `mer_${startDate}_${endDate}`;
    const cached = globalCache.get<ConsolidatedMERRow[]>(cacheKey);
    if (cached) return cached;

    const [orders, media] = await Promise.all([
      this.getAllOrders(startDate, endDate, false),
      this.getAllMedia(startDate, endDate)
    ]);

    // Agrupa métricas de vendas
    const totalOrders = orders.length;
    const paidOrders = orders.filter(o => o.orderStatus === 'paid');
    const grossRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const approvedRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const approvedCount = paidOrders.length;
    const avgTicket = approvedCount > 0 ? approvedRevenue / approvedCount : 0;
    const approvalRate = totalOrders > 0 ? (approvedCount / totalOrders) * 100 : 0;

    // Agrupa métricas de mídia
    const totalSpend = media.reduce((sum, m) => sum + m.spend, 0);
    const totalImpressions = media.reduce((sum, m) => sum + m.impressions, 0);
    const totalClicks = media.reduce((sum, m) => sum + m.clicks, 0);
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    // Métricas financeiras e eficiência de mídia
    const mer = totalSpend > 0 ? approvedRevenue / totalSpend : 0;
    const realRoas = mer;
    const blendedCpa = approvedCount > 0 ? totalSpend / approvedCount : 0;

    const row: ConsolidatedMERRow = {
      date: startDate || '20261101',
      channel: 'Omnichannel Secret Outlet',
      platform: 'Bagy + Shopify + Mídia Consolidada',
      grossRevenue: parseFloat(grossRevenue.toFixed(2)),
      approvedRevenue: parseFloat(approvedRevenue.toFixed(2)),
      approvedOrders: approvedCount,
      averageTicket: parseFloat(avgTicket.toFixed(2)),
      approvalRate: parseFloat(approvalRate.toFixed(1)),
      totalAdSpend: parseFloat(totalSpend.toFixed(2)),
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: parseFloat(ctr.toFixed(2)),
      cpc: parseFloat(cpc.toFixed(2)),
      mer: parseFloat(mer.toFixed(2)),
      realRoas: parseFloat(realRoas.toFixed(2)),
      blendedCpa: parseFloat(blendedCpa.toFixed(2))
    };

    const result = [row];
    globalCache.set(cacheKey, result, 180);
    return result;
  }

  async getOrganicData(startDate?: string) {
    return this.organic.fetchOrganicData(startDate);
  }
}
