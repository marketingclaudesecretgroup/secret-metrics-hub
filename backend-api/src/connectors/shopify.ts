import axios from 'axios';
import { config } from '../config.js';
import { UnifiedOrder } from '../types/index.js';

export class ShopifyConnector {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = `https://${config.shopify.shopDomain}/admin/api/${config.shopify.apiVersion}`;
    this.token = config.shopify.accessToken;
  }

  async fetchOrders(startDate?: string, endDate?: string): Promise<UnifiedOrder[]> {
    if (!this.token) {
      console.warn('[Shopify] SHOPIFY_ACCESS_TOKEN não configurado. Retornando dados simulados da Secret Outlet.');
      return this.generateMockOrders(startDate, endDate);
    }

    try {
      const params: Record<string, string> = {
        status: 'any',
        limit: '250'
      };

      if (startDate) {
        params.created_at_min = `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}T00:00:00Z`;
      }
      if (endDate) {
        params.created_at_max = `${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}T23:59:59Z`;
      }

      const response = await axios.get(`${this.baseUrl}/orders.json`, {
        headers: {
          'X-Shopify-Access-Token': this.token,
          'Content-Type': 'application/json'
        },
        params
      });

      const orders = response.data.orders || [];

      return orders.map((o: any): UnifiedOrder => {
        const createdAt = o.created_at ? o.created_at.replace(/-/g, '').slice(0, 8) : '20260101';
        let status: UnifiedOrder['orderStatus'] = 'pending';
        if (o.financial_status === 'paid') status = 'paid';
        else if (o.financial_status === 'refunded' || o.financial_status === 'partially_refunded') status = 'refunded';
        else if (o.cancelled_at) status = 'cancelled';

        const total = parseFloat(o.total_price || '0');
        const discounts = parseFloat(o.total_discounts || '0');
        const shipping = o.total_shipping_price_set?.shop_money?.amount 
          ? parseFloat(o.total_shipping_price_set.shop_money.amount) 
          : 0;

        return {
          orderId: `SHOPIFY-${o.order_number || o.id}`,
          platform: 'shopify',
          date: createdAt,
          orderStatus: status,
          paymentMethod: o.payment_gateway_names?.[0] || 'Cartão/Pix',
          customerType: (o.customer?.orders_count && o.customer.orders_count > 1) ? 'Recorrente' : 'Novo',
          utmSource: this.extractParam(o.landing_site, 'utm_source') || 'Direto',
          utmCampaign: this.extractParam(o.landing_site, 'utm_campaign') || 'Sem Campanha',
          totalAmount: total,
          discountAmount: discounts,
          shippingAmount: shipping,
          netAmount: total - shipping,
          itemCount: o.line_items ? o.line_items.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0) : 1
        };
      });
    } catch (error: any) {
      console.error('[Shopify] Erro ao buscar pedidos:', error.response?.data || error.message);
      return this.generateMockOrders(startDate, endDate);
    }
  }

  private extractParam(url: string | null, param: string): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url, 'https://secretoutlet.com.br');
      return parsed.searchParams.get(param);
    } catch {
      return null;
    }
  }

  private generateMockOrders(startDate?: string, endDate?: string): UnifiedOrder[] {
    const orders: UnifiedOrder[] = [];
    const count = 45;
    const baseDate = startDate || '20261101';

    for (let i = 0; i < count; i++) {
      const isPaid = i % 5 !== 0;
      const total = 180 + (i * 12) % 350;
      orders.push({
        orderId: `SHOPIFY-SO-${10400 + i}`,
        platform: 'shopify',
        date: baseDate,
        orderStatus: isPaid ? 'paid' : 'cancelled',
        paymentMethod: i % 2 === 0 ? 'PIX' : 'Cartão de Crédito',
        customerType: i % 3 === 0 ? 'Recorrente' : 'Novo',
        utmSource: i % 2 === 0 ? 'google' : 'facebook',
        utmCampaign: 'black_friday_secret_outlet',
        totalAmount: total,
        discountAmount: 25,
        shippingAmount: 20,
        netAmount: total - 20,
        itemCount: 1 + (i % 3)
      });
    }
    return orders;
  }
}
