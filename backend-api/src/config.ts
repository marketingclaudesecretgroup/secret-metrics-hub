import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  masterApiKey: process.env.MASTER_API_KEY || 'secret-outlet-looker-token-2026',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Google Workspace OAuth2 Security
  auth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || '/api/auth/google/callback',
    allowedDomains: (process.env.ALLOWED_GOOGLE_DOMAINS || 'secretoutlet.com.br')
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(Boolean),
    allowedEmails: (process.env.ALLOWED_GOOGLE_EMAILS || 'admin@secretoutlet.com.br,marketing@secretoutlet.com.br,diretoria@secretoutlet.com.br')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean),
    sessionSecret: process.env.SESSION_SECRET || 'secret-metrics-super-secure-session-key-2026',
    devLoginEnabled: process.env.DEV_LOGIN_ENABLED === 'true' // Desabilitado por padrão (100% Google Workspace oficial)
  },

  // Secret Outlet E-commerce
  shopify: {
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN || 'secretoutlet.myshopify.com',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
    apiVersion: '2024-01'
  },
  bagy: {
    apiUrl: process.env.BAGY_API_URL || 'https://api.bagy.com.br/v1',
    apiToken: process.env.BAGY_API_TOKEN || '',
    storeId: process.env.BAGY_STORE_ID || ''
  },

  // Mídia de Performance
  metaAds: {
    accessToken: process.env.META_ACCESS_TOKEN || '',
    actAccountId: process.env.META_AD_ACCOUNT_ID || ''
  },
  googleAds: {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    clientId: process.env.GOOGLE_ADS_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN || '',
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID || ''
  },
  criteoAds: {
    clientId: process.env.CRITEO_CLIENT_ID || '',
    clientSecret: process.env.CRITEO_CLIENT_SECRET || '',
    advertiserId: process.env.CRITEO_ADVERTISER_ID || ''
  },

  // Analytics & SEO
  ga4: {
    propertyId: process.env.GA4_PROPERTY_ID || '',
    credentialsJson: process.env.GA4_CREDENTIALS_JSON || ''
  },
  gsc: {
    siteUrl: process.env.GSC_SITE_URL || 'https://www.secretoutlet.com.br',
    credentialsJson: process.env.GSC_CREDENTIALS_JSON || ''
  },

  // Looker Studio Deployment
  lookerStudio: {
    deploymentId: process.env.LOOKER_DEPLOYMENT_ID || 'AKfycbySecretMetricsConnectorLooker2026',
    connectorName: 'Secret Metrics - Conector Oficial Secret Outlet'
  }
};
