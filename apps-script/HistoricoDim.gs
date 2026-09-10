/**
 * Leitura da aba Histórico DIM · Controle de Horas
 */

function normalizeDateKey_(value) {
  var raw = String(value || '').trim();
  if (!raw) return null;

  var iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];

  var br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return br[3] + '-' + br[2] + '-' + br[1];

  var parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return null;
}

function normalizeAgent_(value) {
  var email = String(value || '').trim().toLowerCase();
  return email.indexOf('@') >= 0 ? email : null;
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseHistoricoDimRows_(values) {
  if (!values || !values.length) return [];

  var header = values[0].map(function (cell) { return String(cell || '').trim(); });
  var headerNorm = header.map(normalizeHeader_);
  var slotStartIdx = -1;
  for (var h = 0; h < header.length; h++) {
    if (header[h] === '06:00') { slotStartIdx = h; break; }
  }

  var dateIdx = -1;
  var agentIdx = -1;
  var clusterIdx = -1;
  for (var i = 0; i < headerNorm.length; i++) {
    if (['data', 'date', 'csi_slot_date', 'dia'].indexOf(headerNorm[i]) >= 0) dateIdx = i;
    if (['agente', 'agent', 'xmart', 'email', 'analista'].indexOf(headerNorm[i]) >= 0) agentIdx = i;
    if (['cluster', 'time', 'squad'].indexOf(headerNorm[i]) >= 0) clusterIdx = i;
  }

  var resolvedDateIdx = dateIdx >= 0 ? dateIdx : 0;
  var resolvedAgentIdx = agentIdx >= 0 ? agentIdx : 1;
  var resolvedClusterIdx = clusterIdx >= 0 ? clusterIdx : 5;
  var out = [];

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (!row || row.length < 2) continue;

    var date = normalizeDateKey_(row[resolvedDateIdx]);
    var agent = normalizeAgent_(row[resolvedAgentIdx]);
    if (!date || !agent) continue;

    var slots = {};
    if (slotStartIdx >= 0) {
      CONFIG.SLOT_LABELS.forEach(function (label, idx) {
        slots[label] = normalizeSlotToken_(row[slotStartIdx + idx] || '');
      });
    }

    if (slotStartIdx < 0) continue;

    out.push({
      date: date,
      agent: agent,
      cluster: String(row[resolvedClusterIdx] || 'CSI/CSS').trim() || 'CSI/CSS',
      slots: slots,
    });
  }

  return out;
}

function loadHistoricoDimRows_(forceRefresh) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'historico_dim_rows_v1';

  if (!forceRefresh) {
    var cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  var ss = getSpreadsheet_();
  var sheet = resolveHistoricoDimSheet_(ss);
  if (!sheet) {
    throw new Error('Aba Histórico DIM não encontrada na planilha vinculada.');
  }

  var values = sheet.getDataRange().getValues();
  var rows = parseHistoricoDimRows_(values);
  if (!rows.length) {
    throw new Error('Nenhuma linha válida na aba ' + CONFIG.HISTORICO_DIM_SHEET);
  }

  cache.put(cacheKey, JSON.stringify(rows), CONFIG.CACHE_TTL_SEC);
  return rows;
}

function clearDimensionamentosCache_() {
  CacheService.getScriptCache().remove('historico_dim_rows_v1');
}

function getDimensionamentosMeta_() {
  var status = getSpreadsheetLinkStatus_();
  return {
    source: 'apps-script',
    spreadsheetId: status.spreadsheetId || null,
    spreadsheetName: status.spreadsheetName || null,
    sheetName: status.sheetName || getHistoricoDimSheetNamePreference_(),
    spreadsheetUrl: status.spreadsheetUrl || null,
    fetchedAt: new Date().toISOString(),
    message: status.linked
      ? 'Histórico DIM · ' + (status.spreadsheetName || status.spreadsheetId)
      : 'Planilha não vinculada',
  };
}
