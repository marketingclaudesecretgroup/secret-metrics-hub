export interface DateRange {
  startDate: string; // YYYYMMDD ou YYYY-MM-DD
  endDate: string;
}

export type PlatformType = 'bagy' | 'shopify';
export type OrderStatus = 'paid' | 'pending' | 'cancelled' | 'refunded';

export interface UnifiedOrder {
  orderId: string;
  platform: PlatformType;
  date: string; // YYYYMMDD
  orderStatus: OrderStatus;
  paymentMethod: string;
  customerType: 'Novo' | 'Recorrente';
  utmSource: string;
  utmCampaign: string;
  totalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  netAmount: number;
  itemCount: number;
}

export interface AdPerformanceRow {
  date: string; // YYYYMMDD
  adPlatform: 'Google Ads' | 'Meta Ads' | 'Criteo Ads';
  campaignName: string;
  adGroupName: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
}

export interface ConsolidatedMERRow {
  date: string; // YYYYMMDD
  channel: string;
  platform: string;
  grossRevenue: number;
  approvedRevenue: number;
  approvedOrders: number;
  averageTicket: number;
  approvalRate: number;
  totalAdSpend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  mer: number;
  realRoas: number;
  blendedCpa: number;
  [key: string]: any;
}

export interface LookerRequestPayload {
  apiKey: string;
  dataset: 'consolidated_mer' | 'ecommerce_orders' | 'paid_media' | 'organic_traffic';
  orderStatusFilter?: 'paid_only' | 'all';
  dateRange: {
    startDate?: string;
    endDate?: string;
  };
  fields: string[];
}
