/**
 * Catálogo de acesso · aba Gemini - BD
 * Xmart → aba Analista
 * Não-Xmart (Xpert, liderança, etc.) → aba Analista + Liderança
 * Xmart ou Xpert → pode tratar jobs
 */

function getBdSheetNamePreference_() {
  return (
    getScriptProps_().getProperty('BD_SHEET_NAME') ||
    CONFIG.BD_SHEET_NAME ||
    'Gemini - BD'
  );
}

function getBdSheetGid_() {
  var raw =
    getScriptProps_().getProperty('BD_SHEET_GID') ||
    CONFIG.BD_SHEET_GID ||
    '';
  var gid = Number(raw);
  return gid > 0 ? gid : 0;
}

function getBdSpreadsheetId_() {
  return (
    CONFIG.BD_SPREADSHEET_ID ||
    getScriptProps_().getProperty('BD_SPREADSHEET_ID') ||
    DEFAULT_SPREADSHEET_ID
  );
}

function syncBdSourceConfig_() {
  var props = getScriptProps_();
  props.setProperty('BD_SPREADSHEET_ID', String(CONFIG.BD_SPREADSHEET_ID));
  props.setProperty('BD_SHEET_GID', String(CONFIG.BD_SHEET_GID));
  if (CONFIG.BD_SHEET_NAME) {
    props.setProperty('BD_SHEET_NAME', String(CONFIG.BD_SHEET_NAME));
  }
}

function getBdSpreadsheet_() {
  return SpreadsheetApp.openById(getBdSpreadsheetId_());
}

function findBdSheet_(spreadsheet) {
  var gid = getBdSheetGid_();
  if (gid) {
    var byGid = spreadsheet.getSheets();
    for (var g = 0; g < byGid.length; g++) {
      if (byGid[g].getSheetId() === gid) return byGid[g];
    }
  }

  var preferred = getBdSheetNamePreference_();
  var direct = spreadsheet.getSheetByName(preferred);
  if (direct) return direct;

  var preferredNorm = normalizeSheetName_(preferred);
  var sheets = spreadsheet.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (normalizeSheetName_(sheets[i].getName()) === preferredNorm) return sheets[i];
  }
  for (var j = 0; j < sheets.length; j++) {
    var fuzzy = normalizeSheetName_(sheets[j].getName());
    if (
      (fuzzy.indexOf('gemini') >= 0 && fuzzy.indexOf('bd') >= 0) ||
      fuzzy === 'bd' ||
      fuzzy.indexOf(' bd') >= 0 ||
      fuzzy.indexOf('bd ') === 0
    ) {
      return sheets[j];
    }
  }
  throw new Error(
    'Aba BD não encontrada (gid ' +
      (gid || '—') +
      ' / nome "' +
      preferred +
      '").'
  );
}

function isEmailValue_(value) {
  return /@/.test(String(value || '').trim());
}

function normalizeRoleLabel_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizePackLabel_(value) {
  return normalizeRoleLabel_(value).replace(/&/g, ' ').replace(/\s+/g, ' ').trim();
}

function isXmartRole_(role) {
  var r = normalizeRoleLabel_(role);
  if (!r) return false;
  if (isXpertRole_(role)) return false;
  return r.indexOf('xmart') >= 0;
}

function isXpertRole_(role) {
  var r = normalizeRoleLabel_(role);
  if (!r) return false;
  return r.indexOf('xpert') >= 0;
}

function detectRoleFromRow_(row, emailIdx) {
  if (!row || !row.length) return '';
  for (var c = 0; c < row.length; c++) {
    if (c === emailIdx) continue;
    var val = row[c];
    if (!val || isEmailValue_(val)) continue;
    if (isXmartRole_(val)) return 'xmart';
    if (isXpertRole_(val)) return 'xpert';
  }
  return '';
}

function normalizeBdRoster_(roster) {
  if (!roster) return roster;
  roster.xmarts = roster.xmarts || [];
  roster.xperts = roster.xperts || [];
  roster.leadership = roster.leadership || [];
  roster.operators = roster.operators || [];
  roster.xmartByActorId = roster.xmartByActorId || {};
  roster.operators.forEach(function (email) {
    if (roster.xperts.indexOf(email) < 0) roster.xperts.push(email);
  });
  return roster;
}

function isBdMember_(email) {
  var normalized = normalizeEmail_(email);
  if (!normalized) return false;
  var roster = loadBdRoster_();
  var groups = [roster.xmarts, roster.xperts, roster.leadership, roster.operators];
  for (var i = 0; i < groups.length; i++) {
    if (groups[i].indexOf(normalized) >= 0) return true;
  }
  return false;
}

function isPeopleMgmtEngagementPack_(pack) {
  var p = normalizePackLabel_(pack);
  if (!p) return false;
  return p.indexOf('people') >= 0 && p.indexOf('mgmt') >= 0 && p.indexOf('engagement') >= 0;
}

function uniqueEmails_(list) {
  var seen = {};
  var out = [];
  list.forEach(function (email) {
    var e = normalizeEmail_(email);
    if (!e || seen[e]) return;
    seen[e] = true;
    out.push(e);
  });
  return out;
}

function fallbackBdRoster_() {
  return {
    xmarts: uniqueEmails_(CONFIG.XMART_EMAILS),
    xperts: uniqueEmails_(getConfiguredXpertEmails_()),
    leadership: [],
    operators: [],
    xmartByActorId: {},
    source: 'fallback-config',
    loadedAt: nowIso_(),
  };
}

function getConfiguredXpertEmails_() {
  var out = (CONFIG.XPERT_EMAILS || []).slice();
  var extra =
    getScriptProps_().getProperty('XPERT_EMAILS') ||
    '';
  extra.split(',').forEach(function (email) {
    var e = normalizeEmail_(email);
    if (e && out.indexOf(e) < 0) out.push(e);
  });
  return out;
}

function normalizeActorId_(value) {
  return String(value == null ? '' : value).trim();
}

function parseBdRosterRows_(rows) {
  var xmarts = [];
  var xperts = [];
  var leadership = [];
  var operators = [];
  var xmartByActorId = {};
  if (!rows || !rows.length) {
    return {
      xmarts: xmarts,
      xperts: xperts,
      leadership: leadership,
      operators: operators,
      xmartByActorId: xmartByActorId,
    };
  }

  var emailIdx = 0;
  var roleIdx = 6;
  var packIdx = -1;
  var actorIdx =
    CONFIG.BD_ACTOR_ID_COL != null ? Number(CONFIG.BD_ACTOR_ID_COL) : 13;
  var startRow = 0;
  var hasRoleMetadata = false;
  var header = rows[0] || [];

  var headerLooksLikeData = isEmailValue_(header[0]);
  if (!headerLooksLikeData) {
    for (var c = 0; c < header.length; c++) {
      var h = normalizeRoleLabel_(header[c]);
      if (['email', 'e-mail', 'mail', 'analista', 'xmart', 'agente'].indexOf(h) >= 0) {
        emailIdx = c;
      }
      if (['funcao', 'funcao', 'role', 'cargo', 'papel', 'func'].indexOf(h) >= 0) {
        roleIdx = c;
        hasRoleMetadata = true;
      }
      if (['pack', 'squad', 'chapter', 'area', 'tribo', 'time', 'celula', 'célula'].indexOf(h) >= 0) {
        packIdx = c;
        hasRoleMetadata = true;
      }
      if (
        h === 'actor id' ||
        h === 'actorid' ||
        h === 'actor' ||
        h.indexOf('actor') >= 0
      ) {
        actorIdx = c;
      }
    }
    startRow = 1;
  }

  for (var r = startRow; r < rows.length; r++) {
    var row = rows[r];
    if (!row || !row.length) continue;

    var email = '';
    if (isEmailValue_(row[emailIdx])) {
      email = normalizeEmail_(row[emailIdx]);
    } else {
      for (var ec = 0; ec < row.length; ec++) {
        if (isEmailValue_(row[ec])) {
          email = normalizeEmail_(row[ec]);
          break;
        }
      }
    }
    if (!email) continue;

    var role = row.length > roleIdx ? row[roleIdx] : '';
    if (!role || !String(role).trim()) {
      role = detectRoleFromRow_(row, emailIdx);
    }
    var pack = packIdx >= 0 && row.length > packIdx ? row[packIdx] : '';
    var actorId =
      actorIdx >= 0 && row.length > actorIdx
        ? normalizeActorId_(row[actorIdx])
        : '';

    var isXmart = false;
    if (role && String(role).trim()) {
      if (isXmartRole_(role)) {
        xmarts.push(email);
        isXmart = true;
      } else if (isXpertRole_(role)) {
        xperts.push(email);
        if (isPeopleMgmtEngagementPack_(pack)) {
          operators.push(email);
        }
      } else {
        leadership.push(email);
      }
    } else if (hasRoleMetadata) {
      leadership.push(email);
    } else {
      xmarts.push(email);
      isXmart = true;
    }

    if (isXmart && actorId) {
      xmartByActorId[actorId] = email;
      xmartByActorId[actorId.toLowerCase()] = email;
    }
  }

  return {
    xmarts: uniqueEmails_(xmarts.filter(function (email) {
      return xperts.indexOf(email) < 0;
    })),
    xperts: uniqueEmails_(xperts),
    leadership: uniqueEmails_(leadership),
    operators: uniqueEmails_(operators),
    xmartByActorId: xmartByActorId,
  };
}

function loadBdRoster_(forceRefresh) {
  var cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    var cached = cache.get(CONFIG.BD_CACHE_KEY);
    if (cached) return normalizeBdRoster_(JSON.parse(cached));
  }

  try {
    syncBdSourceConfig_();
    var sheet = findBdSheet_(getBdSpreadsheet_());
    var parsed = parseBdRosterRows_(sheet.getDataRange().getValues());
    var roster = {
      xmarts: parsed.xmarts,
      xperts: parsed.xperts,
      leadership: parsed.leadership,
      operators: parsed.operators,
      xmartByActorId: parsed.xmartByActorId || {},
      source: 'joots-bd',
      sheetName: sheet.getName(),
      sheetGid: sheet.getSheetId(),
      spreadsheetId: getBdSpreadsheetId_(),
      loadedAt: nowIso_(),
    };
    if (!roster.xmarts.length && !roster.xperts.length && !roster.leadership.length && !roster.operators.length) {
      roster = normalizeBdRoster_(fallbackBdRoster_());
    }
    roster = normalizeBdRoster_(roster);
    cache.put(CONFIG.BD_CACHE_KEY, JSON.stringify(roster), CONFIG.CACHE_TTL_SEC);
    return roster;
  } catch (err) {
    var fallback = normalizeBdRoster_(fallbackBdRoster_());
    fallback.error = err.message || String(err);
    return fallback;
  }
}

function clearBdRosterCache_() {
  CacheService.getScriptCache().remove(CONFIG.BD_CACHE_KEY);
}

function getXmartAllowlist_() {
  return loadBdRoster_().xmarts;
}

function getOperatorAllowlist_() {
  return loadBdRoster_().operators;
}

function getXpertAllowlist_() {
  var roster = loadBdRoster_();
  var out = (roster.xperts || []).slice();
  (roster.operators || []).forEach(function (email) {
    if (out.indexOf(email) < 0) out.push(email);
  });
  getConfiguredXpertEmails_().forEach(function (email) {
    if (out.indexOf(email) < 0) out.push(email);
  });
  return out;
}

function resolveXmartEmailByActorId_(actorId) {
  var id = normalizeActorId_(actorId);
  if (!id) return '';
  var map = loadBdRoster_().xmartByActorId || {};
  return map[id] || map[id.toLowerCase()] || '';
}

function isXmartEmail_(email) {
  var normalized = normalizeEmail_(email);
  if (!normalized) return false;
  return getXmartAllowlist_().indexOf(normalized) >= 0;
}

function isXpertEmail_(email) {
  var normalized = normalizeEmail_(email);
  if (!normalized) return false;
  return getXpertAllowlist_().indexOf(normalized) >= 0;
}

function canTreatJobs_(email) {
  var normalized = normalizeEmail_(email);
  if (!normalized) return false;
  return isXmartEmail_(normalized) || isXpertEmail_(normalized);
}

function isLeadershipEmail_(email) {
  var normalized = normalizeEmail_(email);
  if (!normalized) return false;
  if (isXmartEmail_(normalized)) return false;
  if (getLeadershipAllowlist_().indexOf(normalized) >= 0) return true;
  var roster = loadBdRoster_();
  return roster.leadership.indexOf(normalized) >= 0;
}

function getAnalystDirectory_() {
  var roster = loadBdRoster_();
  return (roster.xmarts || [])
    .slice()
    .sort(function (a, b) {
      return a.localeCompare(b, 'pt-BR');
    })
    .map(function (email) {
      return { email: email, role: 'xmart' };
    });
}
