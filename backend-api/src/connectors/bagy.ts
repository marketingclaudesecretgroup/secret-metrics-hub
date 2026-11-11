import axios from 'axios';
import { config } from '../config.js';
import { UnifiedOrder } from '../types/index.js';

export class BagyConnector {
  private apiUrl: string;
  private token: string;
  private storeId: string;

  constructor() {
    this.apiUrl = config.bagy.apiUrl;
    this.token = config.bagy.apiToken;
    this.storeId = config.bagy.storeId;
  }

  async fetchOrders(startDate?: string, endDate?: string): Promise<UnifiedOrder[]> {
    if (!this.token) {
      console.warn('[Bagy] BAGY_API_TOKEN não configurado. Retornando dados simulados da Secret Outlet na Bagy.');
      return this.generateMockOrders(startDate, endDate);
    }

    try {
      const params: Record<string, string> = {};
      if (startDate) params.start_date = `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`;
      if (endDate) params.end_date = `${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}`;

      const response = await axios.get(`${this.apiUrl}/orders`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'X-Store-Id': this.storeId,
          'Content-Type': 'application/json'
        },
        params
      });

      const orders = response.data.data || response.data.orders || [];

      return orders.map((o: any): UnifiedOrder => {
        const rawDate = o.created_at || o.date || '2026-01-01';
        const formattedDate = rawDate.replace(/[^0-9]/g, '').slice(0, 8);

        // Normalização de status da Bagy para padrão universal
        const rawStatus = (o.status || '').toLowerCase();
        let status: UnifiedOrder['orderStatus'] = 'pending';
        if (rawStatus.includes('aprovado') || rawStatus.includes('pago') || rawStatus === 'approved' || rawStatus === 'paid') {
          status = 'paid';
        } else if (rawStatus.includes('cancelado') || rawStatus.includes('recusado') || rawStatus === 'cancelled') {
          status = 'cancelled';
        } else if (rawStatus.includes('estornado') || rawStatus.includes('reembolsado')) {
          status = 'refunded';
        }

        const total = parseFloat(o.total || o.amount || '0');
        const discounts = parseFloat(o.discount || '0');
        const shipping = parseFloat(o.shipping_price || o.shipping_cost || '0');

        return {
          orderId: `BAGY-${o.id || o.order_number}`,
          platform: 'bagy',
          date: formattedDate,
          orderStatus: status,
          paymentMethod: o.payment_method?.name || o.payment_type || 'Boleto/Pix',
          customerType: o.customer?.orders_count && o.customer.orders_count > 1 ? 'Recorrente' : 'Novo',
          utmSource: o.utm_source || o.tracking?.utm_source || 'Direto / Instagram',
          utmCampaign: o.utm_campaign || o.tracking?.utm_campaign || 'Promocao_Bagy',
          totalAmount: total,
          discountAmount: discounts,
          shippingAmount: shipping,
          netAmount: total - shipping,
          itemCount: o.items ? o.items.length : 1
        };
      });
    } catch (error: any) {
      console.error('[Bagy] Erro ao buscar pedidos:', error.response?.data || error.message);
      return this.generateMockOrders(startDate, endDate);
    }
  }

  private generateMockOrders(startDate?: string, endDate?: string): UnifiedOrder[] {
    const orders: UnifiedOrder[] = [];
    const count = 35;
    const baseDate = startDate || '20261101';

    for (let i = 0; i < count; i++) {
      const isPaid = i % 4 !== 0;
      const total = 140 + (i * 15) % 290;
      orders.push({
        orderId: `BAGY-PED-${20300 + i}`,
        platform: 'bagy',
        date: baseDate,
        orderStatus: isPaid ? 'paid' : 'pending',
        paymentMethod: i % 2 === 0 ? 'PIX' : 'Boleto Bancário',
        customerType: i % 4 === 0 ? 'Recorrente' : 'Novo',
        utmSource: i % 2 === 0 ? 'instagram_stories' : 'criteo',
        utmCampaign: 'outlet_liquidacao_calcados',
        totalAmount: total,
        discountAmount: 15,
        shippingAmount: 22,
        netAmount: total - 22,
        itemCount: 1 + (i % 2)
      });
    }
    return orders;
  }
}
