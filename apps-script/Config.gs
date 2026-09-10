/**
 * Configuração central · JOOTs CSI · Dimensionamentos (Operação)
 *
 * Planilha padrão (nova): 1kiHkfUGeOvR_m2W7dwKD3PUAXHZefD4jDiZfpx3oUCw
 * Prioridade de resolução:
 * 1. Propriedade DIMENSIONAMENTOS_SPREADSHEET_ID (vinculada pelo painel ou menu)
 * 2. Planilha ativa (script container-bound)
 * 3. DEFAULT_SPREADSHEET_ID abaixo
 */

var DEFAULT_SPREADSHEET_ID = '1kiHkfUGeOvR_m2W7dwKD3PUAXHZefD4jDiZfpx3oUCw';

var CONFIG = {
  /** Nome padrão da aba de escala — ajuste se sua planilha usar outro nome */
  HISTORICO_DIM_SHEET: 'Histórico Dim',
  CACHE_TTL_SEC: 300,

  /**
   * Fallback de canais Slack quando a propriedade SLACK_CHANNELS estiver vazia.
   * Formato: id-catalogo:CHANNEL_ID:nome-do-canal
   */
  DEFAULT_SLACK_CHANNELS: 'csi-gpd-me-ajuda:C0BCC4YV4GG:gpd-me-ajuda-teste',

  /** Nomes amigáveis para IDs Slack conhecidos (nunca exibir C… na UI) */
  SLACK_CHANNEL_NAME_BY_ID: {
    C0BCC4YV4GG: 'gpd-me-ajuda-teste',
  },

  YEAR_OPTIONS: [2024, 2025, 2026, 2027],

  MONTH_OPTIONS: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ],

  WEEKDAY_OPTIONS: [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Segunda-feira' },
    { value: 2, label: 'Terça-feira' },
    { value: 3, label: 'Quarta-feira' },
    { value: 4, label: 'Quinta-feira' },
    { value: 5, label: 'Sexta-feira' },
    { value: 6, label: 'Sábado' },
  ],

  SLOT_LABELS: [
    '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
    '22:00', '22:30', '23:00', '23:30', '00:00', '00:30', '01:00', '01:30',
    '02:00', '02:30',
  ],

  CHANNEL_SLOT_CATALOG: [
    { channelId: 'csi-gpd-me-ajuda', slackName: 'csi-gpd-me-ajuda', slotToken: 'ch', label: 'CH' },
    { channelId: 'incidentes-criticos-me-ajuda', slackName: 'incidentes-críticos-me-ajuda', slotToken: 'ch', label: 'CH' },
    { channelId: 'x-request', slackName: 'x-request', slotToken: 'ch', label: 'CH' },
    { channelId: 'gemini-ops-request', slackName: 'gemini-ops-request', slotToken: 'gmn', label: 'GMN' },
    { channelId: 'ajuda-lossiano', slackName: 'ajuda-lossiano', slotToken: 'loss', label: 'loss' },
    { channelId: 'x-request-uv', slackName: 'x-request-uv', slotToken: 'uv', label: 'UV' },
    { channelId: 'purple-phone-tickets', slackName: 'purple-phone-tickets', slotToken: 'rpi', label: 'RPI' },
  ],

  /** Xperts · fallback quando a BD não carrega (+ propriedade XPERT_EMAILS no script) */
  XPERT_EMAILS: [],

  XMART_EMAILS: [
    'ana.mendes@nubank.com.br',
    'angelica.almeida@nubank.com.br',
    'camila.paula@nubank.com.br',
    'caroline.coutinho@nubank.com.br',
    'elisangela.silva@nubank.com.br',
    'erica.lopes@nubank.com.br',
    'heloisa.costa@nubank.com.br',
    'ingrid.machado@nubank.com.br',
    'ingryd.caroline@nubank.com.br',
    'jacqueline.barreto@nubank.com.br',
    'luan.ferreira@nubank.com.br',
    'marcos.felix@nubank.com.br',
    'maycon.cardoso@nubank.com.br',
    'natalia.barbosa@nubank.com.br',
    'pablo.santos@nubank.com.br',
    'rafaela.baccarin@nubank.com.br',
    'vanessa.mendes@nubank.com.br',
  ],

  /** Planilha JOOTs CSI - Logs · aba BD (G = função, N = Actor ID). Preferência por gid. */
  BD_SPREADSHEET_ID: '1kiHkfUGeOvR_m2W7dwKD3PUAXHZefD4jDiZfpx3oUCw',
  BD_SHEET_GID: 1108692587,
  BD_SHEET_NAME: 'Gemini - BD',
  BD_CACHE_KEY: 'joots_bd_roster_v6',
  BD_ACTOR_ID_COL: 13, // coluna N (0-based)
  PEOPLE_MGMT_ENGAGEMENT_PACK: 'people mgmt & engagement',
};

function getScriptProps_() {
  return PropertiesService.getScriptProperties();
}

function getHistoricoDimSheetNamePreference_() {
  return (
    getScriptProps_().getProperty('DIMENSIONAMENTOS_SHEET_NAME') ||
    CONFIG.HISTORICO_DIM_SHEET
  );
}

function parseSpreadsheetIdFromUrl_(input) {
  var raw = String(input || '').trim();
  if (!raw) return null;
  if (/^[a-zA-Z0-9_-]{20,}$/.test(raw) && raw.indexOf('/') === -1) return raw;
  var match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function normalizeSheetName_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function resolveHistoricoDimSheet_(spreadsheet) {
  var preferred = getHistoricoDimSheetNamePreference_();
  var direct = spreadsheet.getSheetByName(preferred);
  if (direct) return direct;

  var preferredNorm = normalizeSheetName_(preferred);
  var sheets = spreadsheet.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var nameNorm = normalizeSheetName_(sheets[i].getName());
    if (nameNorm === preferredNorm) return sheets[i];
  }
  for (var j = 0; j < sheets.length; j++) {
    var fuzzy = normalizeSheetName_(sheets[j].getName());
    if (fuzzy.indexOf('histor') >= 0 && fuzzy.indexOf('dim') >= 0) {
      return sheets[j];
    }
  }

  throw new Error(
    'Aba "' + preferred + '" não encontrada. Crie a aba Histórico DIM na planilha.'
  );
}

function getSpreadsheet_() {
  var props = getScriptProps_();
  var linkedId = props.getProperty('DIMENSIONAMENTOS_SPREADSHEET_ID');
  if (linkedId) return SpreadsheetApp.openById(linkedId);

  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (ignored) {}

  return SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
}

function getSpreadsheetLinkStatus_() {
  try {
    var ss = getSpreadsheet_();
    var sheet = resolveHistoricoDimSheet_(ss);
    var props = getScriptProps_();
    return {
      linked: true,
      source: props.getProperty('DIMENSIONAMENTOS_SPREADSHEET_ID')
        ? 'property'
        : 'active-spreadsheet',
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl() + '#gid=' + sheet.getSheetId(),
      sheetName: sheet.getName(),
      sheetGid: sheet.getSheetId(),
    };
  } catch (err) {
    return {
      linked: false,
      error: err.message || String(err),
    };
  }
}

function linkSpreadsheet_(input, sheetName) {
  var id = parseSpreadsheetIdFromUrl_(input);
  if (!id) {
    return { ok: false, error: 'Informe uma URL ou ID válido da planilha Google.' };
  }

  var ss;
  try {
    ss = SpreadsheetApp.openById(id);
  } catch (err) {
    return {
      ok: false,
      error: 'Sem permissão ou planilha inexistente. Compartilhe a planilha com você e tente de novo.',
    };
  }

  if (sheetName) {
    getScriptProps_().setProperty('DIMENSIONAMENTOS_SHEET_NAME', sheetName);
  }

  var sheet = resolveHistoricoDimSheet_(ss);
  var props = getScriptProps_();
  props.setProperty('DIMENSIONAMENTOS_SPREADSHEET_ID', id);
  props.setProperty('DIMENSIONAMENTOS_SHEET_NAME', sheet.getName());
  props.setProperty('DIMENSIONAMENTOS_SHEET_GID', String(sheet.getSheetId()));
  clearDimensionamentosCache_();

  return {
    ok: true,
    spreadsheetId: id,
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl() + '#gid=' + sheet.getSheetId(),
    sheetName: sheet.getName(),
  };
}

function useActiveSpreadsheet_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    return { ok: false, error: 'Abra o script a partir de Extensões → Apps Script na planilha desejada.' };
  }
  return linkSpreadsheet_(active.getId());
}

function unlinkSpreadsheet_() {
  var props = getScriptProps_();
  props.deleteProperty('DIMENSIONAMENTOS_SPREADSHEET_ID');
  props.deleteProperty('DIMENSIONAMENTOS_SHEET_GID');
  clearDimensionamentosCache_();
  return { ok: true };
}

function getAllSlotTokens_() {
  var seen = {};
  var out = [];
  CONFIG.CHANNEL_SLOT_CATALOG.forEach(function (entry) {
    if (!seen[entry.slotToken]) {
      seen[entry.slotToken] = true;
      out.push(entry.slotToken);
    }
  });
  return out;
}

function getSpreadsheetUrl_() {
  var status = getSpreadsheetLinkStatus_();
  if (!status.linked) return null;
  return status.spreadsheetUrl;
}
