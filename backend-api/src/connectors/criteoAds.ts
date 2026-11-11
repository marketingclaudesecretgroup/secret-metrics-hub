import { config } from '../config.js';
import { AdPerformanceRow } from '../types/index.js';

export class CriteoAdsConnector {
  private advertiserId: string;

  constructor() {
    this.advertiserId = config.criteoAds.advertiserId;
  }

  async fetchPerformance(startDate?: string, endDate?: string): Promise<AdPerformanceRow[]> {
    return this.generateMockPerformance(startDate);
  }

  private generateMockPerformance(startDate?: string): AdPerformanceRow[] {
    const d = startDate || '20261101';
    return [
      {
        date: d,
        adPlatform: 'Criteo Ads',
        campaignName: '[CRITEO] Dynamic Retargeting - Secret Outlet Web',
        adGroupName: 'Visitantes Recentes & Abandonos de Carrinho',
        spend: 195.40,
        impressions: 48000,
        clicks: 880,
        conversions: 11,
        conversionValue: 2450.00
      }
    ];
  }
}
