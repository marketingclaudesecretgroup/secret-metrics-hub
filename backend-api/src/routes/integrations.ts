import { Router, Request, Response } from 'express';
import { config } from '../config.js';

export const integrationsRouter = Router();

integrationsRouter.get('/status', (req: Request, res: Response) => {
  const integrations = [
    {
      id: 'shopify',
      name: 'Shopify (Secret Outlet)',
      category: 'E-commerce',
      status: config.shopify.accessToken ? 'connected' : 'configured_mock',
      account: config.shopify.shopDomain
    },
    {
      id: 'bagy',
      name: 'Bagy (Secret Outlet)',
      category: 'E-commerce',
      status: config.bagy.apiToken ? 'connected' : 'configured_mock',
      account: 'Loja Bagy Secret Outlet'
    },
    {
      id: 'google_ads',
      name: 'Google Ads',
      category: 'Paid Media',
      status: config.googleAds.refreshToken ? 'connected' : 'configured_mock',
      account: config.googleAds.customerId || 'Conta Principal Secret Outlet'
    },
    {
      id: 'meta_ads',
      name: 'Meta Ads (Facebook & Instagram)',
      category: 'Paid Media',
      status: config.metaAds.accessToken ? 'connected' : 'configured_mock',
      account: config.metaAds.actAccountId || 'Secret Outlet Ads'
    },
    {
      id: 'criteo_ads',
      name: 'Criteo Ads',
      category: 'Paid Media',
      status: config.criteoAds.clientId ? 'connected' : 'configured_mock',
      account: config.criteoAds.advertiserId || 'Secret Outlet Retargeting'
    },
    {
      id: 'ga4',
      name: 'Google Analytics 4',
      category: 'Analytics',
      status: config.ga4.propertyId ? 'connected' : 'configured_mock',
      account: 'Propriedade Secret Outlet Web'
    },
    {
      id: 'gsc',
      name: 'Google Search Console',
      category: 'SEO',
      status: 'connected',
      account: config.gsc.siteUrl
    }
  ];

  res.json({
    timestamp: new Date().toISOString(),
    totalIntegrations: integrations.length,
    integrations
  });
});
