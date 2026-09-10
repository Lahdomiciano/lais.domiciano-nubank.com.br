/**
 * Retorna URLs oficiais do projeto (menu / diagnóstico)
 */
function getWebAppUrls_() {
  var deployments = [
    'AKfycbzccco71XUsaDrhcmmfvxMffMyFmHxviBNcxjvINDUshOAdeXw_ikey8R9jqlDXICOG',
  ];
  return {
    spreadsheetUrl:
      'https://docs.google.com/spreadsheets/d/1kiHkfUGeOvR_m2W7dwKD3PUAXHZefD4jDiZfpx3oUCw/edit',
    scriptEditorUrl:
      'https://script.google.com/d/1u2fNiWt8HJ17_r-G-Avxhl-Vsd3MzYbO_Mjp1Z5aD_ikAjPzMNfxKUT6/edit',
    webAppUrl:
      'https://script.google.com/a/macros/nubank.com.br/s/AKfycbzccco71XUsaDrhcmmfvxMffMyFmHxviBNcxjvINDUshOAdeXw_ikey8R9jqlDXICOG/exec',
    serviceUrl: ScriptApp.getService() ? ScriptApp.getService().getUrl() : null,
  };
}

function menuShowWebAppUrl_() {
  var urls = getWebAppUrls_();
  SpreadsheetApp.getUi().alert(
    'Painel JOOTs CSI\n\n' +
      'Web App:\n' + urls.webAppUrl + '\n\n' +
      'Planilha:\n' + urls.spreadsheetUrl
  );
}
