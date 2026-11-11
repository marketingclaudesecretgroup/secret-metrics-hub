import axios from 'axios';
import { ConsolidatedMERRow } from '../types/index.js';
import { persistentStorage, StoredAlert } from './storage.js';

export interface HealthEvaluationResult {
  status: 'HEALTHY' | 'ATTENTION' | 'CRITICAL';
  score: number; // 0 a 100
  evaluatedAt: string;
  alerts: StoredAlert[];
  summary: {
    criticalCount: number;
    warningCount: number;
    infoCount: number;
  };
  metrics: {
    mer: number;
    blendedCpa: number;
    approvalRate: number;
    totalSpend: number;
    approvedRevenue: number;
  };
}

export class AnomalyAlertEngine {
  /**
   * Avalia a saúde operacional e financeira do e-commerce Secret Outlet
   */
  async evaluateHealth(merRow: ConsolidatedMERRow): Promise<HealthEvaluationResult> {
    const alerts: StoredAlert[] = [];
    const timestamp = new Date().toISOString();

    const mer = Number(merRow.mer) || 0;
    const blendedCpa = Number(merRow.blendedCpa) || 0;
    const approvalRate = Number(merRow.approvalRate) || 0;
    const totalSpend = Number(merRow.totalAdSpend) || 0;
    const approvedRevenue = Number(merRow.approvedRevenue) || 0;

    // 1. AVALIAÇÃO DE MER (Marketing Efficiency Ratio)
    if (mer > 0 && mer < 4.0) {
      alerts.push({
        id: `alert_mer_crit_${Date.now()}`,
        code: 'MER_CRITICAL',
        title: 'MER Abaixo do Ponto de Equilíbrio',
        category: 'MER',
        severity: 'critical',
        currentValue: mer,
        threshold: 4.0,
        message: `MER crítico em ${mer.toFixed(2)}x (meta mínima: 4.00x). A margem de contribuição operacional está sob forte pressão.`,
        recommendation: 'Pausar imediatamente criativos e campanhas com ROAS reportado < 2.0x. Realocar verba para públicos quentes e remarketing Criteo.',
        timestamp,
        acknowledged: false
      });
    } else if (mer >= 4.0 && mer < 5.0) {
      alerts.push({
        id: `alert_mer_warn_${Date.now()}`,
        code: 'MER_ATTENTION',
        title: 'MER em Zona de Atenção',
        category: 'MER',
        severity: 'warning',
        currentValue: mer,
        threshold: 5.0,
        message: `MER em ${mer.toFixed(2)}x. Eficiência aceitável, mas com margem de segurança reduzida contra oscilações de CPM.`,
        recommendation: 'Negociar lances em Meta e Google Ads e otimizar criativos estáticos de alta retenção.',
        timestamp,
        acknowledged: false
      });
    } else if (mer >= 6.0) {
      alerts.push({
        id: `alert_mer_info_${Date.now()}`,
        code: 'MER_EXCELLENT',
        title: 'MER de Alta Performance',
        category: 'MER',
        severity: 'success',
        currentValue: mer,
        threshold: 6.0,
        message: `MER excelente de ${mer.toFixed(2)}x! Cada R$ 1,00 investido em tráfego pago gerou R$ ${mer.toFixed(2)} em receita confirmada.`,
        recommendation: 'Alavancagem positiva detectada. Recomendado aumentar orçamento diário de aquisição em até +15% para acelerar escala.',
        timestamp,
        acknowledged: false
      });
    }

    // 2. AVALIAÇÃO DE BLENDED CPA
    if (blendedCpa > 45.0) {
      alerts.push({
        id: `alert_cpa_crit_${Date.now()}`,
        code: 'CPA_ELEVATED',
        title: 'CPA Blended Acima do Teto',
        category: 'CPA',
        severity: blendedCpa > 55 ? 'critical' : 'warning',
        currentValue: blendedCpa,
        threshold: 45.0,
        message: `CPA Blended em R$ ${blendedCpa.toFixed(2)} por pedido faturado (teto máximo recomendado: R$ 45,00).`,
        recommendation: 'Revisar campanhas de topo de funil com alto custo de aquisição. Estimular cross-sell e aumento de ticket médio.',
        timestamp,
        acknowledged: false
      });
    }

    // 3. AVALIAÇÃO DE TAXA DE APROVAÇÃO
    if (approvalRate > 0 && approvalRate < 75.0) {
      alerts.push({
        id: `alert_appr_crit_${Date.now()}`,
        code: 'APPROVAL_CRITICAL',
        title: 'Queda Severa na Taxa de Aprovação de Pagamentos',
        category: 'APPROVAL',
        severity: 'critical',
        currentValue: approvalRate,
        threshold: 75.0,
        message: `Taxa de aprovação em ${approvalRate.toFixed(1)}% (mínimo esperado: 75.0%). Risco iminente de perda de receita em pedidos pendentes.`,
        recommendation: 'Verificar status da adquirente/anti-fraude no Shopify e Bagy. Disparar réguas automáticas de recuperação de PIX e cartão recusado.',
        timestamp,
        acknowledged: false
      });
    } else if (approvalRate >= 75.0 && approvalRate < 80.0) {
      alerts.push({
        id: `alert_appr_warn_${Date.now()}`,
        code: 'APPROVAL_ATTENTION',
        title: 'Taxa de Aprovação Abaixo do Padrão',
        category: 'APPROVAL',
        severity: 'warning',
        currentValue: approvalRate,
        threshold: 80.0,
        message: `Taxa de aprovação em ${approvalRate.toFixed(1)}%. Desempenho moderado com oportunidade de ganho em checkout transparente.`,
        recommendation: 'Promover incentivos de pagamento instantâneo via PIX com desconto adicional.',
        timestamp,
        acknowledged: false
      });
    }

    // Calcula Score e Status Global
    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const warningCount = alerts.filter(a => a.severity === 'warning').length;
    const infoCount = alerts.filter(a => a.severity === 'info' || a.severity === 'success').length;

    let status: 'HEALTHY' | 'ATTENTION' | 'CRITICAL' = 'HEALTHY';
    let score = 95;

    if (criticalCount > 0) {
      status = 'CRITICAL';
      score = Math.max(30, 85 - (criticalCount * 25));
    } else if (warningCount > 0) {
      status = 'ATTENTION';
      score = Math.max(65, 90 - (warningCount * 12));
    } else {
      score = 98;
    }

    // Persiste alertas no storage
    persistentStorage.saveAlerts(alerts);

    // Se houver alerta crítico e webhook configurado, envia notificação assíncrona
    if (criticalCount > 0 && process.env.ALERT_WEBHOOK_URL) {
      this.notifyExternalWebhook(process.env.ALERT_WEBHOOK_URL, alerts.filter(a => a.severity === 'critical'))
        .catch(err => console.error('[AlertEngine] Falha ao enviar notificação de webhook externo:', err.message));
    }

    return {
      status,
      score,
      evaluatedAt: timestamp,
      alerts,
      summary: {
        criticalCount,
        warningCount,
        infoCount
      },
      metrics: {
        mer,
        blendedCpa,
        approvalRate,
        totalSpend,
        approvedRevenue
      }
    };
  }

  /**
   * Envia notificação para Slack, Discord ou Webhook HTTP Genérico
   */
  async notifyExternalWebhook(webhookUrl: string, criticalAlerts: StoredAlert[]): Promise<boolean> {
    if (!webhookUrl || criticalAlerts.length === 0) return false;

    const alertTitles = criticalAlerts.map(a => `• *[${a.category}]* ${a.title}: ${a.message}\n  👉 _${a.recommendation}_`).join('\n\n');

    const payload = {
      text: `🚨 *[Secret Metrics Alert]* Anomalia Crítica Detectada no E-commerce Secret Outlet\n\n${alertTitles}\n\n🔗 Acesse o portal: https://secret-metrics.onrender.com/`,
      content: `🚨 **[Secret Metrics Alert]** Anomalia Crítica Detectada no E-commerce Secret Outlet\n\n${alertTitles}`,
      alerts: criticalAlerts
    };

    try {
      await axios.post(webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      console.log(`[AlertEngine] Notificação de anomalia enviada com sucesso para ${webhookUrl.split('?')[0]}`);
      return true;
    } catch (err: any) {
      console.warn(`[AlertEngine] Falha ao notificar webhook externo: ${err.message}`);
      return false;
    }
  }
}

export const anomalyAlertEngine = new AnomalyAlertEngine();
