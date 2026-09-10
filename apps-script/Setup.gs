/**
 * Inicializa a planilha vinculada · aba Histórico Dim + cabeçalhos de slots
 * Rode uma vez: setupHistoricoDimSheet() no editor Apps Script
 */

function setupHistoricoDimSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) ss = SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);

  var sheetName = getHistoricoDimSheetNamePreference_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    var first = ss.getSheets()[0];
    if (first && ss.getSheets().length === 1 && normalizeSheetName_(first.getName()) === 'sheet1') {
      sheet = first;
      sheet.setName(sheetName);
    } else {
      sheet = ss.insertSheet(sheetName);
    }
  }

  var header = ['Data', 'Agente', '', '', '', 'Cluster'].concat(CONFIG.SLOT_LABELS);
  sheet.clear();
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 240);
  sheet.setColumnWidth(6, 100);

  var props = getScriptProps_();
  props.setProperty('DIMENSIONAMENTOS_SPREADSHEET_ID', ss.getId());
  props.setProperty('DIMENSIONAMENTOS_SHEET_NAME', sheet.getName());
  props.setProperty('DIMENSIONAMENTOS_SHEET_GID', String(sheet.getSheetId()));
  clearDimensionamentosCache_();

  return {
    ok: true,
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl() + '#gid=' + sheet.getSheetId(),
    sheetName: sheet.getName(),
    columns: header.length,
  };
}

function runInitialSetup_() {
  return setupHistoricoDimSheet();
}

/**
 * Concede edição na planilha vinculada (e no script container-bound).
 * Ex.: grantSpreadsheetEditor('mariana.antunes@nubank.com.br')
 */
function grantSpreadsheetEditor(email) {
  var normalized = normalizeEmail_(email);
  if (!normalized || normalized.indexOf('@') < 0) {
    throw new Error('Informe um e-mail válido.');
  }
  var ss = SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
  ss.addEditor(normalized);
  return {
    ok: true,
    email: normalized,
    role: 'editor',
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    spreadsheetName: ss.getName(),
  };
}
