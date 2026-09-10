/**
 * Persistência de jobs + sync status (planilha, não só cache de 5 min)
 */

var JOBS_KEY = 'joots_jobs_v5';
var SYNC_KEY = 'joots_sync_v5';
var JOBS_STORE_SHEET = '_joots_store';
var STORE_CHUNK = 45000;

function nowIso_() {
  return new Date().toISOString();
}

function getJobsSpreadsheet_() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {}
  return SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
}

function getJobsStoreSheet_() {
  var ss = getJobsSpreadsheet_();
  var sheet = ss.getSheetByName(JOBS_STORE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(JOBS_STORE_SHEET);
    sheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
    sheet.setFrozenRows(1);
    try {
      sheet.hideSheet();
    } catch (err) {}
  }
  return sheet;
}

function readStoreValue_(key) {
  var sheet = getJobsStoreSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var values = sheet.getRange(2, 1, last, 2).getValues();
  var parts = [];
  var found = false;
  for (var i = 0; i < values.length; i++) {
    var rowKey = String(values[i][0] || '');
    if (rowKey === key || rowKey.indexOf(key + '__') === 0) {
      found = true;
      parts.push({
        key: rowKey,
        value: String(values[i][1] || ''),
      });
    }
  }
  if (!found) return null;
  parts.sort(function (a, b) {
    if (a.key === key) return -1;
    if (b.key === key) return 1;
    var ai = Number(a.key.split('__')[1] || 0);
    var bi = Number(b.key.split('__')[1] || 0);
    return ai - bi;
  });
  return parts
    .map(function (p) {
      return p.value;
    })
    .join('');
}

function writeStoreValue_(key, raw) {
  var sheet = getJobsStoreSheet_();
  var last = sheet.getLastRow();
  if (last >= 2) {
    var values = sheet.getRange(2, 1, last, 2).getValues();
    for (var i = values.length - 1; i >= 0; i--) {
      var rowKey = String(values[i][0] || '');
      if (rowKey === key || rowKey.indexOf(key + '__') === 0) {
        sheet.deleteRow(i + 2);
      }
    }
  }

  var text = String(raw || '');
  var chunks = [];
  if (!text) {
    chunks = [''];
  } else {
    for (var c = 0; c < text.length; c += STORE_CHUNK) {
      chunks.push(text.slice(c, c + STORE_CHUNK));
    }
  }

  var rows = chunks.map(function (chunk, idx) {
    return [idx === 0 ? key : key + '__' + idx, chunk];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 2).setValues(rows);
}

function readPersistentJson_(key) {
  var raw = readStoreValue_(key);
  if (!raw) {
    var cacheRaw = CacheService.getScriptCache().get(key);
    if (!cacheRaw) return null;
    try {
      return JSON.parse(cacheRaw);
    } catch (err) {
      return null;
    }
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function writePersistentJson_(key, value) {
  var raw = JSON.stringify(value);
  writeStoreValue_(key, raw);
  try {
    CacheService.getScriptCache().put(key, raw, Math.min(CONFIG.CACHE_TTL_SEC || 300, 21600));
  } catch (err) {}
}

function getSyncStatus_() {
  var stored = readPersistentJson_(SYNC_KEY);
  if (stored) {
    stored.channels = stored.channels || loadConfiguredChannels_();
    return stored;
  }
  var token = getSlackBotToken_();
  var channels = loadConfiguredChannels_();
  return {
    mode: token ? 'slack' : 'demo',
    lastSyncAt: null,
    message: token
      ? 'Pronto. Clique em Sync Slack para puxar #' +
        ((channels[0] && (channels[0].slackChannelName || channels[0].name)) ||
          'canais') +
        '.'
      : 'Modo demo · configure SLACK_BOT_TOKEN nas propriedades do script.',
    channels: channels,
  };
}

function saveSyncStatus_(status) {
  writePersistentJson_(SYNC_KEY, status);
}

function getJobs_() {
  var stored = readPersistentJson_(JOBS_KEY);
  if (stored && Object.prototype.toString.call(stored) === '[object Array]') {
    // Mesmo lista vazia: não sobrescrever com demo (isso apagava tratativas).
    return stored;
  }
  var token = '';
  try {
    token = getSlackBotToken_() || '';
  } catch (err) {
    token = '';
  }
  if (token) return [];
  var jobs = createDemoJobs_();
  saveJobs_(jobs);
  return jobs;
}

function saveJobs_(jobs) {
  writePersistentJson_(JOBS_KEY, jobs || []);
}

function findJob_(id) {
  var jobs = getJobs_();
  for (var i = 0; i < jobs.length; i++) {
    if (jobs[i].id === id) return jobs[i];
  }
  return null;
}

function upsertJob_(next) {
  var jobs = getJobs_();
  var found = false;
  jobs = jobs.map(function (j) {
    if (j.id === next.id) {
      found = true;
      return next;
    }
    return j;
  });
  if (!found) jobs.unshift(next);
  saveJobs_(jobs);
  return next;
}

function resetDemoJobs_() {
  var jobs = createDemoJobs_();
  saveJobs_(jobs);
  saveSyncStatus_({
    mode: 'demo',
    lastSyncAt: nowIso_(),
    message: 'Demo regenerado.',
    channels: loadConfiguredChannels_(),
  });
  return jobs;
}

function countsByChannel_(channelId) {
  var base = { pendente: 0, em_atendimento: 0, concluido: 0, negado: 0, sem_retorno: 0 };
  getJobs_().forEach(function (j) {
    if (j.channelId === channelId) base[j.status] += 1;
  });
  return base;
}

function pendingCount_() {
  return getJobs_().filter(function (j) {
    return j.status === 'pendente';
  }).length;
}

function clearJobsCache_() {
  CacheService.getScriptCache().remove(JOBS_KEY);
  CacheService.getScriptCache().remove(SYNC_KEY);
  try {
    writeStoreValue_(JOBS_KEY, '');
    writeStoreValue_(SYNC_KEY, '');
  } catch (err) {}
}
