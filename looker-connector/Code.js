/**
 * Secret Metrics - Looker Studio Community Connector
 * Conector de dados para Google Looker Studio conectado à API própria.
 */

var cc = DataStudioApp.createCommunityConnector();

/**
 * 1. AUTENTICAÇÃO
 * Tipo: KEY (Token de API gerado no seu portal SaaS).
 */
function getAuthType() {
  return cc.newAuthTypeResponse()
    .setAuthType(cc.AuthType.KEY)
    .setHelpUrl('https://meuhub.secretoutlet.com.br/docs/token')
    .build();
}

function resetAuth() {
  var userProperties = PropertiesService.getUserProperties();
  userProperties.deleteProperty('dscc.key');
}

function isAuthValid() {
  var userProperties = PropertiesService.getUserProperties();
  var key = userProperties.getProperty('dscc.key');
  return validateKey(key);
}

function setCredentials(request) {
  var key = request.key;
  if (!validateKey(key)) {
    return {
      errorCode: 'INVALID_CREDENTIALS'
    };
  }
  var userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty('dscc.key', key);
  return {
    errorCode: 'NONE'
  };
}

function validateKey(key) {
  if (!key || key.trim().length < 8) {
    return false;
  }
  return true;
}

function getApiKey() {
  var userProperties = PropertiesService.getUserProperties();
  return userProperties.getProperty('dscc.key');
}

/**
 * URL Base da sua API Backend (onde roda o servidor Express/FastAPI)
 */
function getApiBaseUrl() {
  var scriptProperties = PropertiesService.getScriptProperties();
  var url = scriptProperties.getProperty('API_BASE_URL');
  if (!url) {
    // URL padrão oficial de produção no Render
    return 'https://secret-metrics-hub.onrender.com/api/looker';
  }
  return url;
}

/**
 * 2. CONFIGURAÇÃO (Tela de seleção no Looker Studio)
 */
function getConfig(request) {
  var config = cc.getConfig();

  config.newInfo()
    .setId('instructions')
    .setText('Selecione o Dataset desejado para carregar no Looker Studio.');

  var selectDataset = config.newSelectSingle()
    .setId('dataset')
    .setName('Dataset')
    .setHelpText('Escolha o conjunto de dados a ser analisado')
    .setAllowOverride(true);

  selectDataset.addOption(config.newOptionBuilder().setLabel('Consolidado: E-commerce + Mídia (MER & ROAS Real)').setValue('consolidated_mer'));
  selectDataset.addOption(config.newOptionBuilder().setLabel('E-commerce Secret Outlet: Pedidos Unificados (Bagy + Shopify)').setValue('ecommerce_orders'));
  selectDataset.addOption(config.newOptionBuilder().setLabel('Mídia Paga Unificada: Google + Meta + Criteo').setValue('paid_media'));
  selectDataset.addOption(config.newOptionBuilder().setLabel('Tráfego Orgânico & Web: GA4 + Search Console').setValue('organic_traffic'));

  var filterStatus = config.newSelectSingle()
    .setId('orderStatusFilter')
    .setName('Filtro de Pedidos de E-commerce')
    .setHelpText('Defina se quer considerar apenas pedidos faturados/pagos ou todos')
    .setAllowOverride(true);

  filterStatus.addOption(config.newOptionBuilder().setLabel('Apenas Pagos / Aprovados (Recomendado para ROAS)').setValue('paid_only'));
  filterStatus.addOption(config.newOptionBuilder().setLabel('Todos os Pedidos (Incluindo Pendentes e Cancelados)').setValue('all'));

  config.setDateRangeRequired(true);

  return config.build();
}

/**
 * 3. SCHEMA (Definição de Dimensões e Métricas)
 */
function getFields(request) {
  var dataset = (request && request.configParams && request.configParams.dataset) || 'consolidated_mer';
  var fields = cc.getFields();
  var types = cc.FieldType;
  var aggregations = cc.AggregationType;

  // Dimensão padrão comum: Data
  fields.newDimension()
    .setId('date')
    .setName('Data')
    .setType(types.YEAR_MONTH_DAY);

  if (dataset === 'consolidated_mer') {
    // Dimensões
    fields.newDimension().setId('channel').setName('Canal / Fonte').setType(types.TEXT);
    fields.newDimension().setId('platform').setName('Plataforma').setType(types.TEXT);

    // Métricas de Vendas (Shopify + Bagy)
    fields.newMetric().setId('grossRevenue').setName('Receita Bruta').setType(types.CURRENCY_BRL).setAggregation(aggregations.SUM);
    fields.newMetric().setId('approvedRevenue').setName('Receita Aprovada (Paga)').setType(types.CURRENCY_BRL).setAggregation(aggregations.SUM);
    fields.newMetric().setId('approvedOrders').setName('Pedidos Aprovados').setType(types.NUMBER).setAggregation(aggregations.SUM);
    fields.newMetric().setId('averageTicket').setName('Ticket Médio').setType(types.CURRENCY_BRL).setAggregation(aggregations.AVG);
    fields.newMetric().setId('approvalRate').setName('Taxa de Aprovação (%)').setType(types.PERCENT).setAggregation(aggregations.AVG);

    // Métricas de Mídia (Google + Meta + Criteo)
    fields.newMetric().setId('totalAdSpend').setName('Investimento Total em Mídia').setType(types.CURRENCY_BRL).setAggregation(aggregations.SUM);
    fields.newMetric().setId('impressions').setName('Impressões').setType(types.NUMBER).setAggregation(aggregations.SUM);
    fields.newMetric().setId('clicks').setName('Cliques').setType(types.NUMBER).setAggregation(aggregations.SUM);
    fields.newMetric().setId('ctr').setName('CTR (%)').setType(types.PERCENT).setAggregation(aggregations.AVG);
    fields.newMetric().setId('cpc').setName('CPC Médio').setType(types.CURRENCY_BRL).setAggregation(aggregations.AVG);

    // Métricas Calculadas Avançadas
    fields.newMetric().setId('mer').setName('MER (Marketing Efficiency Ratio)').setType(types.NUMBER).setAggregation(aggregations.AVG);
    fields.newMetric().setId('realRoas').setName('ROAS Real Global').setType(types.NUMBER).setAggregation(aggregations.AVG);
    fields.newMetric().setId('blendedCpa').setName('CPA Blended (Custo / Pedido Aprovado)').setType(types.CURRENCY_BRL).setAggregation(aggregations.AVG);
  } else if (dataset === 'ecommerce_orders') {
    // Pedidos Detalhados Secret Outlet
    fields.newDimension().setId('orderId').setName('ID do Pedido').setType(types.TEXT);
    fields.newDimension().setId('platform').setName('Plataforma (Bagy ou Shopify)').setType(types.TEXT);
    fields.newDimension().setId('orderStatus').setName('Status do Pedido').setType(types.TEXT);
    fields.newDimension().setId('paymentMethod').setName('Método de Pagamento').setType(types.TEXT);
    fields.newDimension().setId('customerType').setName('Tipo de Cliente (Novo / Recorrente)').setType(types.TEXT);
    fields.newDimension().setId('utmSource').setName('UTM Source').setType(types.TEXT);
    fields.newDimension().setId('utmCampaign').setName('UTM Campaign').setType(types.TEXT);

    fields.newMetric().setId('totalAmount').setName('Valor Total').setType(types.CURRENCY_BRL).setAggregation(aggregations.SUM);
    fields.newMetric().setId('discountAmount').setName('Descontos').setType(types.CURRENCY_BRL).setAggregation(aggregations.SUM);
    fields.newMetric().setId('shippingAmount').setName('Frete').setType(types.CURRENCY_BRL).setAggregation(aggregations.SUM);
    fields.newMetric().setId('netAmount').setName('Valor Líquido').setType(types.CURRENCY_BRL).setAggregation(aggregations.SUM);
    fields.newMetric().setId('itemCount').setName('Qtd de Itens').setType(types.NUMBER).setAggregation(aggregations.SUM);
  } else if (dataset === 'paid_media') {
    // Mídia Paga
    fields.newDimension().setId('adPlatform').setName('Rede de Anúncios (Google, Meta, Criteo)').setType(types.TEXT);
    fields.newDimension().setId('campaignName').setName('Nome da Campanha').setType(types.TEXT);
    fields.newDimension().setId('adGroupName').setName('Conjunto de Anúncios').setType(types.TEXT);

    fields.newMetric().setId('spend').setName('Gasto').setType(types.CURRENCY_BRL).setAggregation(aggregations.SUM);
    fields.newMetric().setId('impressions').setName('Impressões').setType(types.NUMBER).setAggregation(aggregations.SUM);
    fields.newMetric().setId('clicks').setName('Cliques').setType(types.NUMBER).setAggregation(aggregations.SUM);
    fields.newMetric().setId('conversions').setName('Conversões Registradas').setType(types.NUMBER).setAggregation(aggregations.SUM);
    fields.newMetric().setId('conversionValue').setName('Receita Reportada na Plataforma').setType(types.CURRENCY_BRL).setAggregation(aggregations.SUM);
    fields.newMetric().setId('reportedRoas').setName('ROAS Reportado').setType(types.NUMBER).setAggregation(aggregations.AVG);
  } else {
    // Orgânico / SEO / GA4
    fields.newDimension().setId('pagePath').setName('Página / URL').setType(types.TEXT);
    fields.newDimension().setId('searchQuery').setName('Termo de Pesquisa (GSC)').setType(types.TEXT);

    fields.newMetric().setId('sessions').setName('Sessões (GA4)').setType(types.NUMBER).setAggregation(aggregations.SUM);
    fields.newMetric().setId('organicClicks').setName('Cliques Orgânicos (GSC)').setType(types.NUMBER).setAggregation(aggregations.SUM);
    fields.newMetric().setId('organicImpressions').setName('Impressões Orgânicas (GSC)').setType(types.NUMBER).setAggregation(aggregations.SUM);
    fields.newMetric().setId('averagePosition').setName('Posição Média (GSC)').setType(types.NUMBER).setAggregation(aggregations.AVG);
  }

  return fields;
}

function getSchema(request) {
  var fields = getFields(request).build();
  return { schema: fields };
}

/**
 * 4. DADOS (getData)
 * Chamada à API backend própria e retorno das linhas ao Looker Studio.
 */
function getData(request) {
  var apiKey = getApiKey();
  var requestedFieldIds = request.fields.map(function(field) {
    return field.name;
  });

  var requestedFields = getFields(request).forIds(requestedFieldIds);

  var payload = {
    apiKey: apiKey,
    dataset: request.configParams.dataset || 'consolidated_mer',
    orderStatusFilter: request.configParams.orderStatusFilter || 'paid_only',
    dateRange: request.dateRange || {},
    fields: requestedFieldIds
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var url = getApiBaseUrl() + '/data';
  var response = UrlFetchApp.fetch(url, options);
  var statusCode = response.getResponseCode();

  if (statusCode === 401 || statusCode === 403) {
    cc.newUserError()
      .setText('Token de API inválido ou expirado. Verifique sua chave no portal da Secret Metrics.')
      .throwException();
  } else if (statusCode !== 200) {
    cc.newUserError()
      .setText('Erro ao carregar dados da API (' + statusCode + '): ' + response.getContentText())
      .throwException();
  }

  var responseData = JSON.parse(response.getContentText());
  var rows = [];

  // Converte a resposta tabular da API no formato estrito do Looker Studio
  if (responseData.rows && responseData.rows.length > 0) {
    rows = responseData.rows.map(function(row) {
      var values = [];
      requestedFieldIds.forEach(function(fieldId) {
        var val = row[fieldId];
        if (val === undefined || val === null) {
          values.push('');
        } else if (typeof val === 'number') {
          values.push(isNaN(val) || !isFinite(val) ? 0 : val);
        } else {
          values.push(String(val));
        }
      });
      return { values: values };
    });
  }

  return {
    schema: requestedFields.build(),
    rows: rows
  };
}
