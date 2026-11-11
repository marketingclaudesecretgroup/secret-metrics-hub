import { config } from '../config.js';

export interface TrafficRow {
  date: string;
  pagePath: string;
  searchQuery: string;
  sessions: number;
  organicClicks: number;
  organicImpressions: number;
  averagePosition: number;
}

export class OrganicAnalyticsConnector {
  async fetchOrganicData(startDate?: string): Promise<TrafficRow[]> {
    const d = startDate || '20261101';
    return [
      {
        date: d,
        pagePath: '/loja/outlet-masculino',
        searchQuery: 'secret outlet confiavel',
        sessions: 1450,
        organicClicks: 820,
        organicImpressions: 9400,
        averagePosition: 1.8
      },
      {
        date: d,
        pagePath: '/categoria/camisetas-lacoste',
        searchQuery: 'camisetas marcas famosas outlet',
        sessions: 890,
        organicClicks: 410,
        organicImpressions: 6100,
        averagePosition: 3.4
      },
      {
        date: d,
        pagePath: '/calcados/tenis',
        searchQuery: 'tenis outlet original',
        sessions: 620,
        organicClicks: 290,
        organicImpressions: 4800,
        averagePosition: 4.1
      }
    ];
  }
}
