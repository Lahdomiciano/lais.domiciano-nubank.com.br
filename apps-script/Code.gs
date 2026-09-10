/**
 * Web App · JOOTs CSI · Analista + Liderança + Dimensionamentos
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('JOOTs CSI')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('JOOTs CSI')
    .addItem('Abrir painel web', 'menuShowWebAppUrl_')
    .addItem('Configurar aba Histórico Dim', 'menuSetupHistoricoDim_')
    .addItem('Testar conexão Slack', 'menuDiagnoseSlack_')
    .addItem('Regenerar jobs demo', 'menuResetDemoJobs_')
    .addItem('Limpar cache jobs', 'clearJobsCache_')
    .addItem('Limpar cache dimensionamentos', 'refreshDimensionamentosCache')
    .addItem('Atualizar catálogo BD (Xmarts)', 'refreshBdRosterCache_')
    .addToUi();
}

function menuDiagnoseSlack_() {
  var result = diagnoseSlackConnection_();
  SpreadsheetApp.getUi().alert(result.message);
  return result;
}

function menuResetDemoJobs_() {
  var jobs = resetDemoJobs_();
  SpreadsheetApp.getUi().alert(
    'Demo regenerado com ' + jobs.length + ' jobs fake.\n\nAtualize o app (Cmd+Shift+R).',
  );
  return jobs;
}

/**
 * Rode uma vez no editor (▶) para autorizar UrlFetchApp / Slack.
 */
function authorizeSlackUrlFetch() {
  UrlFetchApp.fetch('https://slack.com/api/api.test', {
    method: 'post',
    muteHttpExceptions: true,
  });
  return {
    ok: true,
    message:
      'Permissão external_request autorizada. Agora use Sync Slack no app ou o menu Testar conexão Slack.',
  };
}

function menuSetupHistoricoDim_() {
  var result = setupHistoricoDimSheet();
  SpreadsheetApp.getUi().alert(
    'Aba configurada: ' + result.sheetName + '\n' + result.columns + ' colunas'
  );
}

function openWebApp_() {
  var url = ScriptApp.getService().getUrl();
  if (!url) {
    SpreadsheetApp.getUi().alert('Publique o app da web: Implantar > Nova implantação.');
    return;
  }
  var html = HtmlService.createHtmlOutput(
    '<p><a href="' + url + '" target="_blank">' + url + '</a></p>'
  ).setWidth(480).setHeight(90);
  SpreadsheetApp.getUi().showModalDialog(html, 'JOOTs CSI');
}

// Re-export dimensionamentos API (Client usa estes nomes)
function getBootstrap() {
  return getAppBootstrap(Session.getActiveUser().getEmail() || '');
}

function getSpreadsheetLinkStatus() {
  return getSpreadsheetLinkStatus_();
}

function linkSpreadsheet(input, sheetName) {
  return linkSpreadsheet_(input, sheetName);
}

function useActiveSpreadsheet() {
  return useActiveSpreadsheet_();
}

function refreshDimensionamentosCache() {
  clearDimensionamentosCache_();
  if (getSpreadsheetLinkStatus_().linked) loadHistoricoDimRows_(true);
  return { ok: true, at: nowIso_() };
}

function refreshBdRosterCache_() {
  syncBdSourceConfig_();
  clearBdRosterCache_();
  var roster = loadBdRoster_(true);
  SpreadsheetApp.getUi().alert(
    'Catálogo BD atualizado\n\n' +
      'Planilha: ' + (roster.spreadsheetId || '—') + '\n' +
      'Aba: ' + (roster.sheetName || '—') +
      (roster.sheetGid ? ' (gid ' + roster.sheetGid + ')' : '') +
      '\n' +
      'Xmarts: ' + roster.xmarts.length + '\n' +
      'Xperts: ' + (roster.xperts ? roster.xperts.length : 0) +
      '\n' +
      'Liderança (BD): ' + roster.leadership.length + '\n' +
      'Tratam jobs (Xmarts + Xperts): ' +
      (roster.xmarts.length + (roster.xperts ? roster.xperts.length : 0)) +
      '\n' +
      'Fonte: ' + (roster.source || '—') +
      (roster.error ? '\nErro: ' + roster.error : '')
  );
  return roster;
}

function getDimensionamentosPayload(email, filters, analysts, slotScope, forceRefresh) {
  try {
    requireLeadership_(email || Session.getActiveUser().getEmail() || '');
    if (!getSpreadsheetLinkStatus_().linked) {
      return {
        ok: false,
        error: 'Vincule a planilha Histórico Dim antes de carregar dimensionamentos.',
        needsLink: true,
      };
    }
    var rows = loadHistoricoDimRows_(Boolean(forceRefresh));
    var filtered = applyDimensionamentoFilters_(rows, filters || {});
    filtered = applyAnalystFilter_(filtered, analysts || []);
    var slotTokens = slotTokensForChannel_(slotScope || 'all');
    var summaries = aggregateDimensionamentoByXmart_(filtered, slotTokens);
    var totals = aggregateDimensionamentoTotals_(filtered, slotTokens);
    return {
      ok: true,
      meta: getDimensionamentosMeta_(),
      slotScopeLabel: slotLabelForChannel_(slotScope || 'all'),
      slotTokens: slotTokens,
      visibleTokenColumns: slotScope === 'all' ? getAllSlotTokens_() : slotTokens,
      periodLines: buildLeadershipPeriodSummary_(filters || { year: new Date().getFullYear() }),
      totals: totals,
      summaries: summaries,
      rowCount: filtered.length,
    };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}
