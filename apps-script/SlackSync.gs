/**
 * Sync Slack → jobs (Apps Script)
 * SLACK_BOT_TOKEN + SLACK_CHANNELS nas propriedades do script
 * Formato: id:C0123,id2:C0456  ou  id:C0123:nome-exibicao
 */

var CSI_CSS_ROUTING_PATTERNS_ = [
  /\bcsi\b/i,
  /\bcss\b/i,
  /csi[\s/-]*css/i,
  /css[\s/-]*csi/i,
  /@csi/i,
  /@css/i,
  /squad\s*csi/i,
  /time\s*csi/i,
];

function getSlackBotToken_() {
  return String(getScriptProps_().getProperty('SLACK_BOT_TOKEN') || '').trim();
}

function catalogChannelById_(id) {
  var channels = DEFAULT_CHANNELS;
  for (var i = 0; i < channels.length; i++) {
    if (channels[i].id === id) return channels[i];
  }
  return null;
}

function isSlackChannelId_(value) {
  return /^C[A-Z0-9]{8,}$/i.test(String(value || '').trim());
}

function resolveSlackChannelName_(slackChannelId, fallbackName) {
  var id = String(slackChannelId || '').trim();
  var map = CONFIG.SLACK_CHANNEL_NAME_BY_ID || {};
  if (id && map[id]) return map[id];
  var fallback = String(fallbackName || '').trim();
  if (fallback && !isSlackChannelId_(fallback)) return fallback;
  if (id === 'C0BCC4YV4GG') return 'gpd-me-ajuda-teste';
  return fallback && !isSlackChannelId_(fallback) ? fallback : '';
}

function getSlackChannelsRaw_() {
  var fromProps = String(getScriptProps_().getProperty('SLACK_CHANNELS') || '').trim();
  var fallback = String(CONFIG.DEFAULT_SLACK_CHANNELS || '').trim();
  if (!fromProps) return fallback;

  // Se a propriedade veio incompleta (sem nome do canal), completa com o padrão
  // Ex.: "csi-gpd-me-ajuda:C0BCC4YV4GG" → "...:gpd-me-ajuda-teste"
  var parts = fromProps.split(',').map(function (part) {
    var bits = String(part || '')
      .split(':')
      .map(function (s) {
        return String(s || '').trim();
      })
      .filter(Boolean);
    if (bits.length >= 3 && !isSlackChannelId_(bits[2])) return bits.join(':');
    if (bits.length === 2 && isSlackChannelId_(bits[1])) {
      var named = resolveSlackChannelName_(bits[1], '');
      if (named) return bits[0] + ':' + bits[1] + ':' + named;
    }
    if (bits.length === 1 && isSlackChannelId_(bits[0])) {
      var onlyIdName = resolveSlackChannelName_(bits[0], '');
      return 'csi-gpd-me-ajuda:' + bits[0] + ':' + (onlyIdName || 'gpd-me-ajuda-teste');
    }
    return bits.join(':');
  });
  return parts.filter(Boolean).join(',') || fallback;
}

function loadConfiguredChannels_() {
  var raw = getSlackChannelsRaw_();
  var overrides = {};
  var extraIds = [];

  if (raw) {
    raw.split(',').forEach(function (part) {
      var bits = String(part || '')
        .split(':')
        .map(function (s) {
          return String(s || '').trim();
        })
        .filter(function (s) {
          return Boolean(s);
        });
      if (!bits.length) return;
      var id = bits[0];
      var slackChannelId = bits[1] || '';
      var slackChannelName = resolveSlackChannelName_(slackChannelId, bits[2] || '');
      // Evita criar canal cujo "id" seja o próprio C…
      if (isSlackChannelId_(id) && slackChannelId) {
        id = 'csi-gpd-me-ajuda';
      }
      overrides[id] = {
        slackChannelId: slackChannelId || (isSlackChannelId_(bits[0]) ? bits[0] : ''),
        slackChannelName: slackChannelName,
      };
      if (!catalogChannelById_(id)) extraIds.push(id);
    });
  }

  function materialize(base, override) {
    var out = {};
    for (var key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) out[key] = base[key];
    }
    if (override) {
      if (override.slackChannelId) out.slackChannelId = override.slackChannelId;
      if (override.slackChannelName && !isSlackChannelId_(override.slackChannelName)) {
        out.slackChannelName = override.slackChannelName;
      }
    }
    // Nunca exibir ID C… como nome do canal
    if (!out.slackChannelName || isSlackChannelId_(out.slackChannelName)) {
      out.slackChannelName =
        resolveSlackChannelName_(out.slackChannelId, out.id) || out.id;
    }
    return out;
  }

  var channels = DEFAULT_CHANNELS.map(function (ch) {
    return materialize(ch, overrides[ch.id]);
  });

  extraIds.forEach(function (id) {
    if (isSlackChannelId_(id)) return;
    var ov = overrides[id] || {};
    channels.push(
      materialize(
        {
          id: id,
          name: ov.slackChannelName || id,
          slackChannelName: ov.slackChannelName || id,
          accent: 'purple',
          cluster: 'CSI/CSS',
          ownership: 'exclusive',
          treatment: 'Canal de teste / customizado.',
        },
        ov,
      ),
    );
  });

  return channels;
}

/** Rótulo do campo Canal / JOOT · sempre o nome do canal Slack (nunca C…) */
function channelSlackLabel_(channelOrId) {
  if (!channelOrId) return '';
  if (typeof channelOrId === 'string') {
    if (isSlackChannelId_(channelOrId)) {
      return resolveSlackChannelName_(channelOrId, 'gpd-me-ajuda-teste') || channelOrId;
    }
    var found = null;
    var list = loadConfiguredChannels_();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === channelOrId) {
        found = list[i];
        break;
      }
    }
    if (found) return channelSlackLabel_(found);
    return channelOrId;
  }
  var named = resolveSlackChannelName_(
    channelOrId.slackChannelId,
    channelOrId.slackChannelName || channelOrId.id || channelOrId.name,
  );
  if (named && !isSlackChannelId_(named)) return named;
  if (channelOrId.id && !isSlackChannelId_(channelOrId.id)) return channelOrId.id;
  return 'gpd-me-ajuda-teste';
}

function isDirectedToCsiCss_(channel, text) {
  if (!channel) return false;
  if (channel.ownership === 'exclusive') return true;
  var normalized = String(text || '');
  for (var i = 0; i < CSI_CSS_ROUTING_PATTERNS_.length; i++) {
    if (CSI_CSS_ROUTING_PATTERNS_[i].test(normalized)) return true;
  }
  return false;
}

function slackTsToIso_(ts) {
  return new Date(Number(ts) * 1000).toISOString();
}

function titleFromSlackText_(text) {
  var clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return 'Solicitação Slack';
  return clean.length > 72 ? clean.slice(0, 69) + '…' : clean;
}

/** Extrai texto de Block Kit (workflows costumam não ter msg.text útil). */
function extractBlocksText_(blocks) {
  if (!blocks || !blocks.length) return '';
  var parts = [];

  function pushText(value) {
    if (value == null) return;
    if (typeof value === 'string') {
      var s = value.trim();
      if (s) parts.push(s);
      return;
    }
    if (typeof value === 'object') {
      if (value.text) pushText(value.text);
      if (value.emoji && value.emoji.name) parts.push(':' + value.emoji.name + ':');
    }
  }

  function walk(nodes) {
    if (!nodes || !nodes.length) return;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n) continue;
      if (n.type === 'text' || n.type === 'mrkdwn' || n.type === 'plain_text') {
        pushText(n.text != null ? n.text : n);
      } else if (n.type === 'user' && n.user_id) {
        parts.push('<@' + n.user_id + '>');
      } else if (n.text) {
        pushText(n.text);
      }
      if (n.fields) walk(n.fields);
      if (n.elements) walk(n.elements);
      if (n.accessory && n.accessory.elements) walk(n.accessory.elements);
    }
  }

  walk(blocks);
  return parts.join('\n').trim();
}

function slackMessagePlainText_(msg) {
  var text = String((msg && msg.text) || '').trim();
  if (text === '[no preview available]') text = '';
  var fromBlocks = extractBlocksText_(msg && msg.blocks);
  // Workflows: conteúdo real está nos blocks; text costuma ser fallback curto
  if (fromBlocks) {
    if (!text) return fromBlocks;
    if (fromBlocks.length >= text.length) return fromBlocks;
    if (!/dúvida|bko|canal|precisando|motivos/i.test(text)) {
      return fromBlocks;
    }
    return text + '\n' + fromBlocks;
  }
  if (text) return text;
  var attachments = (msg && msg.attachments) || [];
  for (var a = 0; a < attachments.length; a++) {
    var att = attachments[a] || {};
    var chunk = [att.title, att.text, att.fallback, att.pretext]
      .filter(Boolean)
      .join('\n')
      .trim();
    if (chunk) return chunk;
  }
  return '';
}

/** Mensagens do fluxo "me ajuda" (bot/workflow) que viram job. */
function isSolicitationWorkflowMessage_(msg, text) {
  var t = String(text || '');
  if (/precisando da ajuda/i.test(t)) return true;
  if (/\bDúvida\b\s*:/i.test(t) || /\bDuvida\b\s*:/i.test(t)) return true;
  if (/\bBKO\b\s*:/i.test(t)) return true;
  if (/\bCanal\b\s*:/i.test(t) && /motivos|dúvida|duvida|bko/i.test(t)) return true;
  if (/finalizei o job/i.test(t) || /\bverificando\b/i.test(t)) return true;
  if (/🆘|help/i.test(t) && /precisando|ajuda/i.test(t)) return true;

  var username = String(
    (msg && msg.username) ||
      (msg && msg.bot_profile && msg.bot_profile.name) ||
      '',
  ).toLowerCase();
  if (
    username.indexOf('me ajuda') >= 0 ||
    username.indexOf('me-ajuda') >= 0 ||
    username.indexOf('ajuda') >= 0
  ) {
    return true;
  }

  // Bot com Block Kit no canal mapeado = card de solicitação
  if (
    (msg.bot_id || msg.subtype === 'bot_message' || msg.bot_profile) &&
    msg.blocks &&
    msg.blocks.length
  ) {
    return true;
  }
  return false;
}

function shouldIngestSlackMessage_(msg, text) {
  if (!msg || !msg.ts) return false;
  if (msg.thread_ts && msg.thread_ts !== msg.ts) return false;
  var ignoredSubtypes = {
    channel_join: 1,
    channel_leave: 1,
    channel_topic: 1,
    channel_purpose: 1,
    channel_name: 1,
    channel_archive: 1,
    channel_unarchive: 1,
    message_deleted: 1,
    message_changed: 1,
    pinned_item: 1,
    unpinned_item: 1,
    bot_add: 1,
    bot_remove: 1,
  };
  if (msg.subtype && ignoredSubtypes[msg.subtype]) return false;

  var isBot =
    Boolean(msg.bot_id) ||
    msg.subtype === 'bot_message' ||
    Boolean(msg.bot_profile) ||
    Boolean(msg.workflow_id);
  if (isBot) return isSolicitationWorkflowMessage_(msg, text);
  return Boolean(String(text || '').trim());
}

function titleFromSolicitationText_(text) {
  var fields = parseSolicitationFields_(text);
  if (fields.duvida) return titleFromSlackText_(fields.duvida);
  return titleFromSlackText_(text);
}

function parseSolicitationFields_(text) {
  var t = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '');
  var slackHandle = '';
  var mentionUserId = '';

  var mention = t.match(/<@([A-Z0-9]+)(?:\|([^>]+))?>/i);
  if (mention) {
    mentionUserId = mention[1];
    slackHandle = mention[2] ? '@' + mention[2] : '';
  }
  if (!slackHandle) {
    var named = t.match(/@([\w.\-]+)\s+est[aá]\s+precisando/i);
    if (named) slackHandle = '@' + named[1];
  }

  function field(label) {
    var re = new RegExp(
      '(?:\\*|_|•)?\\s*' +
        label +
        '(?:\\*|_)?\\s*:\\s*(?:\\n\\s*)?([^\\n]+)',
      'i',
    );
    var m = t.match(re);
    return m ? String(m[1] || '').replace(/\s+/g, ' ').trim() : '';
  }

  return {
    slackHandle: slackHandle,
    mentionUserId: mentionUserId,
    motivos: field('Motivos relacionados') || field('Motivos') || field('Motivo'),
    duvida: field('Dúvida') || field('Duvida'),
    bko: field('BKO'),
    canal: field('Canal'),
  };
}

function formatSolicitationQuestion_(sol) {
  sol = sol || {};
  var lines = [];
  var who = sol.slackHandle || '';
  if (sol.askerEmail) {
    who = who ? who + ' · ' + sol.askerEmail : sol.askerEmail;
  }
  if (who) lines.push(who);
  lines.push('Canal: ' + (sol.canal ? sol.canal : '—'));
  lines.push(
    'Motivos relacionados: ' + (sol.motivos ? sol.motivos : '—'),
  );
  lines.push('Dúvida: ' + (sol.duvida ? sol.duvida : '—'));
  lines.push('BKO: ' + (sol.bko ? sol.bko : '—'));
  return lines.join('\n');
}

function buildSolicitationPayload_(token, msg, plain, userCache) {
  var fields = parseSolicitationFields_(plain);
  var askerEmail = '';
  var slackHandle = fields.slackHandle || '';

  if (fields.mentionUserId) {
    askerEmail = resolveSlackUserEmail_(token, fields.mentionUserId, userCache);
    if (!slackHandle) {
      try {
        var info = slackApi_(token, 'users.info', { user: fields.mentionUserId });
        var profile = (info.user && info.user.profile) || {};
        var uname =
          profile.display_name ||
          profile.real_name ||
          (info.user && info.user.name) ||
          '';
        if (uname) slackHandle = '@' + String(uname).replace(/^@/, '');
      } catch (err) {}
    }
  } else if (msg && msg.user && !msg.bot_id) {
    askerEmail = resolveSlackUserEmail_(token, msg.user, userCache);
  }

  if (!slackHandle && askerEmail && askerEmail.indexOf('@') > 0) {
    slackHandle = '@' + askerEmail.split('@')[0];
  }
  if (!slackHandle) slackHandle = '@desconhecido';
  if (!askerEmail || askerEmail.indexOf('@') < 0) {
    // tenta e-mail Nubank a partir do handle
    var local = String(slackHandle || '').replace(/^@/, '');
    if (local && local.indexOf('.') >= 0) {
      askerEmail = local.toLowerCase() + '@nubank.com.br';
    } else {
      askerEmail = askerEmail || 'workflow@slack';
    }
  }

  var solicitation = {
    slackHandle: slackHandle,
    mentionUserId: fields.mentionUserId || '',
    askerEmail: askerEmail,
    motivos: fields.motivos || '',
    duvida: fields.duvida || '',
    bko: fields.bko || '',
    canal: fields.canal || '',
  };

  return {
    solicitation: solicitation,
    asker: slackHandle,
    askerEmail: askerEmail,
    title: titleFromSlackText_(fields.duvida || plain),
    question: formatSolicitationQuestion_(solicitation),
  };
}

function extractAskerFromSolicitation_(token, msg, text, userCache) {
  return buildSolicitationPayload_(token, msg, text, userCache).askerEmail;
}

/** 26/08/2026 00:00 no fuso do script (America/Sao_Paulo). */
function solicitationOldestTs_() {
  try {
    var tz = Session.getScriptTimeZone() || 'America/Sao_Paulo';
    var d = Utilities.parseDate('26/08/2026', tz, 'dd/MM/yyyy');
    return String(Math.floor(d.getTime() / 1000));
  } catch (err) {
    return '1787713200';
  }
}

function fetchChannelHistorySince_(token, channelId, oldestTs) {
  var all = [];
  var cursor = '';
  var guard = 0;
  do {
    var payload = {
      channel: channelId,
      limit: 200,
      oldest: String(oldestTs),
      inclusive: 'true',
    };
    if (cursor) payload.cursor = cursor;
    var res = slackApi_(token, 'conversations.history', payload);
    var batch = res.messages || [];
    for (var i = 0; i < batch.length; i++) all.push(batch[i]);
    cursor =
      (res.response_metadata && res.response_metadata.next_cursor) || '';
    guard += 1;
  } while (cursor && guard < 30);
  return all;
}

function slackApi_(token, method, payload) {
  var url = 'https://slack.com/api/' + method;
  var body = payload || {};
  var form = {};
  for (var key in body) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    if (body[key] === undefined || body[key] === null) continue;
    form[key] = String(body[key]);
  }
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { Authorization: 'Bearer ' + token },
    payload: form,
    muteHttpExceptions: true,
  });
  var text = res.getContentText() || '{}';
  // Garante ts como string (evita perda de precisão se vier número no JSON)
  text = text.replace(
    /"(ts|thread_ts|message_ts|event_ts)"\s*:\s*([0-9]+\.[0-9]+)\s*([,}\]])/g,
    '"$1":"$2"$3',
  );
  var parsed = {};
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error('Resposta inválida do Slack (' + method + ').');
  }
  if (!parsed.ok) {
    throw new Error(parsed.error || 'Falha Slack · ' + method);
  }
  return parsed;
}

function resolveSlackUserEmail_(token, userId, cache) {
  if (!userId) return 'desconhecido@slack';
  if (cache[userId]) return cache[userId];
  try {
    var res = slackApi_(token, 'users.info', { user: userId });
    var profile = (res.user && res.user.profile) || {};
    var email =
      profile.email ||
      profile.display_name ||
      (res.user && res.user.name) ||
      userId;
    cache[userId] = email;
    return email;
  } catch (err) {
    cache[userId] = userId;
    return userId;
  }
}

/** Normaliza ts Slack para string "1234567890.123456" (6 casas). */
function normalizeSlackTsString_(ts) {
  var s = String(ts == null ? '' : ts).trim();
  if (!s) return '';
  if (/^\d{16,}$/.test(s)) {
    return s.slice(0, -6) + '.' + s.slice(-6);
  }
  var m = s.match(/^(\d+)\.(\d+)$/);
  if (!m) return s;
  var frac = m[2];
  while (frac.length < 6) frac += '0';
  if (frac.length > 6) frac = frac.substring(0, 6);
  return m[1] + '.' + frac;
}

/** Chave estável canal+ts para casar jobs entre syncs. */
function slackJobKey_(channelId, messageTs) {
  var ch = String(channelId || '').trim();
  var ts = normalizeSlackTsString_(messageTs);
  if (!ch || !ts) return '';
  return ch + ':' + ts;
}

function jobStatusRank_(status) {
  switch (String(status || '')) {
    case 'concluido':
      return 50;
    case 'negado':
      return 40;
    case 'sem_retorno':
      return 30;
    case 'em_atendimento':
      return 20;
    case 'pendente':
      return 10;
    default:
      return 0;
  }
}

function reactionNameSetFromMessage_(msg) {
  var set = {};
  var reactions = (msg && msg.reactions) || [];
  for (var i = 0; i < reactions.length; i++) {
    var name = String((reactions[i] && reactions[i].name) || '')
      .trim()
      .toLowerCase();
    if (name) set[name] = true;
  }
  return set;
}

/**
 * Se o job local sumiu, recupera a fila pelas reactions do card no Slack.
 * Nunca “volta” um job tratado para aguardando se a reaction ainda estiver lá.
 */
function inferJobStatusFromSlackMessage_(msg) {
  var names = reactionNameSetFromMessage_(msg);
  if (names['jobdone-csi'] || names.jobdone) return 'concluido';
  if (names['x-csi']) return 'negado';
  if (names['pendente-csi']) return 'sem_retorno';
  if (names['verificando-csi'] || names.verificando) return 'em_atendimento';
  return 'pendente';
}

/** Em duplicata, mantém o estado mais avançado (e o que tem mais tratativa). */
function preferJobState_(a, b) {
  if (!a) return b;
  if (!b) return a;
  var ra = jobStatusRank_(a.status);
  var rb = jobStatusRank_(b.status);
  if (rb !== ra) return rb > ra ? b : a;
  var ta = JSON.stringify((a && a.timeline) || {}).length;
  var tb = JSON.stringify((b && b.timeline) || {}).length;
  if (tb !== ta) return tb > ta ? b : a;
  if (b.answer && !a.answer) return b;
  return a;
}

function dedupeJobsBySlackKey_(jobs) {
  var bestByKey = {};
  var passthrough = [];
  for (var i = 0; i < (jobs || []).length; i++) {
    var job = jobs[i];
    var key =
      job && job.slack
        ? slackJobKey_(job.slack.channelId, job.slack.messageTs)
        : '';
    if (!key) {
      passthrough.push(job);
      continue;
    }
    bestByKey[key] = preferJobState_(bestByKey[key], job);
  }
  var out = passthrough.slice();
  for (var k in bestByKey) {
    if (Object.prototype.hasOwnProperty.call(bestByKey, k)) {
      out.push(bestByKey[k]);
    }
  }
  return out;
}

/**
 * Permalink canônico = mesmo formato do "Copiar link" do Slack:
 * https://nubank.slack.com/archives/{CHANNEL_ID}/p{ts sem ponto}
 */
function buildSlackPermalink_(channelId, messageTs) {
  if (!channelId || !messageTs) return null;
  var ts = normalizeSlackTsString_(messageTs);
  if (!ts) return null;
  var p = ts.indexOf('.') >= 0 ? ts.replace('.', '') : ts;
  return 'https://nubank.slack.com/archives/' + channelId + '/p' + p;
}

function normalizeSlackPermalinkUrl_(url, channelId, messageTs) {
  if (url) {
    var clean = String(url).trim();
    clean = clean.replace(/^https?:\/\/[^/]+/i, 'https://nubank.slack.com');
    clean = clean.split('?')[0].split('#')[0];
    if (/\/archives\/C[A-Z0-9]+\/p\d{10,}/i.test(clean)) return clean;
  }
  return buildSlackPermalink_(channelId, messageTs);
}

/** Permalink oficial via Slack API (igual ao “Copiar link”). */
function getSlackPermalink_(token, channelId, messageTs) {
  var ts = normalizeSlackTsString_(messageTs);
  if (!token || !channelId || !ts) return buildSlackPermalink_(channelId, messageTs);
  try {
    var res = slackApi_(token, 'chat.getPermalink', {
      channel: channelId,
      message_ts: ts,
    });
    return normalizeSlackPermalinkUrl_(res.permalink, channelId, ts);
  } catch (err) {
    return buildSlackPermalink_(channelId, ts);
  }
}

function padSlackSeq_(n) {
  var s = String(n);
  while (s.length < 4) s = '0' + s;
  return s;
}

function syncJobsFromSlack_(existingJobs) {
  var token = getSlackBotToken_();
  var channels = loadConfiguredChannels_();
  var now = nowIso_();

  if (!token) {
    return {
      mode: 'demo',
      channels: channels,
      jobs: existingJobs && existingJobs.length ? existingJobs : createDemoJobs_(),
      message:
        'Modo demo: defina SLACK_BOT_TOKEN + SLACK_CHANNELS nas propriedades do script.',
      lastSyncAt: now,
    };
  }

  var mapped = channels.filter(function (ch) {
    return Boolean(ch.slackChannelId);
  });
  if (!mapped.length) {
    return {
      mode: 'slack',
      channels: channels,
      jobs: existingJobs || [],
      message:
        'SLACK_CHANNELS vazio. Ex.: csi-gpd-me-ajuda:C0BCC4YV4GG:gpd-me-ajuda-teste',
      lastSyncAt: now,
    };
  }

  var bySlackKey = {};
  (existingJobs || []).forEach(function (j) {
    if (!j || !j.slack || !j.slack.channelId || !j.slack.messageTs) return;
    var key = slackJobKey_(j.slack.channelId, j.slack.messageTs);
    if (!key) return;
    bySlackKey[key] = preferJobState_(bySlackKey[key], j);
  });

  var synced = [];
  var skippedShared = 0;
  var errors = [];
  var userCache = {};
  var seq = (existingJobs || []).length + 1;

  mapped.forEach(function (channel) {
    try {
      var messages = fetchChannelHistorySince_(
        token,
        channel.slackChannelId,
        solicitationOldestTs_(),
      );
      for (var i = 0; i < messages.length; i++) {
        var msg = messages[i];
        var plain = slackMessagePlainText_(msg);
        if (!shouldIngestSlackMessage_(msg, plain)) continue;

        var isWorkflow =
          Boolean(msg.bot_id) ||
          msg.subtype === 'bot_message' ||
          Boolean(msg.bot_profile) ||
          Boolean(msg.workflow_id);
        // csi-gpd-me-ajuda: só cards do fluxo, nunca dúvidas soltas do canal
        if (channel.id === 'csi-gpd-me-ajuda' && !isWorkflow) {
          skippedShared += 1;
          continue;
        }
        if (!isWorkflow && !isDirectedToCsiCss_(channel, plain)) {
          skippedShared += 1;
          continue;
        }

        var messageTs = normalizeSlackTsString_(msg.ts);
        var key = slackJobKey_(channel.slackChannelId, messageTs);
        var arrivedAt = slackTsToIso_(messageTs);
        var routing = {
          ownership: channel.ownership,
          directedToCsiCss: true,
          cluster: channel.cluster,
        };
        var permalink = getSlackPermalink_(
          token,
          channel.slackChannelId,
          messageTs,
        );

        var title;
        var question;
        var asker;
        var askerEmail;
        var solicitation = null;

        if (isWorkflow) {
          var parsed = buildSolicitationPayload_(token, msg, plain, userCache);
          title = parsed.title;
          question = parsed.question;
          asker = parsed.asker;
          askerEmail = parsed.askerEmail;
          solicitation = parsed.solicitation;
        } else {
          title = titleFromSlackText_(plain);
          question = plain;
          asker = resolveSlackUserEmail_(token, msg.user, userCache);
          askerEmail = asker;
        }

        var previous = bySlackKey[key];
        var inferredStatus = inferJobStatusFromSlackMessage_(msg);

        if (previous) {
          var kept = {};
          for (var pk in previous) {
            if (Object.prototype.hasOwnProperty.call(previous, pk)) {
              kept[pk] = previous[pk];
            }
          }
          // Atualiza conteúdo do card — NUNCA zera tratativa local
          kept.title = title;
          kept.question = question;
          kept.asker = asker;
          kept.askerEmail = askerEmail;
          if (solicitation) kept.solicitation = solicitation;
          kept.team = channelSlackLabel_(channel);
          kept.channelId = channel.id;
          kept.routing = routing;
          kept.source = 'slack';
          kept.status = previous.status || 'pendente';
          kept.assignee = previous.assignee;
          kept.answer = previous.answer;
          kept.timeline = kept.timeline || {};
          kept.timeline.arrivedAt = kept.timeline.arrivedAt || arrivedAt;
          // Se local ainda está "aguardando" mas o Slack já tem reaction terminal, alinha a fila
          if (
            jobStatusRank_(inferredStatus) > jobStatusRank_(kept.status) &&
            (kept.status === 'pendente' || !kept.status)
          ) {
            kept.status = inferredStatus;
          }
          kept.slack = kept.slack || {};
          kept.slack.channelId = channel.slackChannelId;
          kept.slack.messageTs = messageTs;
          kept.slack.threadTs = normalizeSlackTsString_(
            msg.thread_ts || messageTs,
          );
          kept.slack.permalink = permalink;
          synced.push(kept);
          continue;
        }

        var created = {
          id: 'SLACK-' + padSlackSeq_(seq++),
          channelId: channel.id,
          team: channelSlackLabel_(channel),
          title: title,
          question: question,
          asker: asker,
          askerEmail: askerEmail,
          createdAt: arrivedAt,
          status: inferredStatus,
          timeline: { arrivedAt: arrivedAt },
          routing: routing,
          source: 'slack',
          slack: {
            channelId: channel.slackChannelId,
            messageTs: messageTs,
            threadTs: messageTs,
            permalink: permalink,
          },
        };
        if (solicitation) created.solicitation = solicitation;
        synced.push(created);
      }
    } catch (err) {
      errors.push(
        '#' +
          (channel.slackChannelName || channel.name) +
          ': ' +
          (err.message || String(err)),
      );
    }
  });

  var syncedKeys = {};
  synced.forEach(function (j) {
    var key =
      j && j.slack ? slackJobKey_(j.slack.channelId, j.slack.messageTs) : '';
    if (key) syncedKeys[key] = true;
  });

  var retained = (existingJobs || []).filter(function (j) {
    if (!j) return false;
    if (j.source === 'demo') return false;
    if (j.source !== 'slack') return true;
    if (!j.slack || !j.slack.channelId || !j.slack.messageTs) return true;
    var key = slackJobKey_(j.slack.channelId, j.slack.messageTs);
    return !syncedKeys[key];
  });

  var merged = dedupeJobsBySlackKey_(synced.concat(retained));

  merged.sort(function (a, b) {
    var ta = new Date((a.timeline && a.timeline.arrivedAt) || 0).getTime();
    var tb = new Date((b.timeline && b.timeline.arrivedAt) || 0).getTime();
    return tb - ta;
  });

  var skippedMsg =
    skippedShared > 0
      ? ' · ' + skippedShared + ' msgs ignoradas (não direcionadas a CSI/CSS)'
      : '';
  var errorMsg = errors.length ? ' · Erros: ' + errors.join(' | ') : '';
  var sampleLink =
    synced[0] && synced[0].slack && synced[0].slack.permalink
      ? ' · Ex.: ' + synced[0].slack.permalink
      : '';

  return {
    mode: 'slack',
    channels: channels,
    jobs: merged,
    message:
      'Sincronizado: ' +
      synced.length +
      ' solicitações (desde 26/08/2026)' +
      skippedMsg +
      errorMsg +
      sampleLink +
      '.',
    lastSyncAt: now,
  };
}

/**
 * Diagnóstico sem expor o token.
 * Menu: JOOTs CSI → Testar conexão Slack
 */
function diagnoseSlackConnection_() {
  var token = getSlackBotToken_();
  var channels = loadConfiguredChannels_();
  var mapped = channels.filter(function (ch) {
    return Boolean(ch.slackChannelId);
  });
  var lines = [];

  if (!token) {
    return {
      ok: false,
      message:
        'SLACK_BOT_TOKEN não encontrado nas propriedades do script.\n\n' +
        'Apps Script → ⚙ Configurações do projeto → Propriedades do script.',
    };
  }
  lines.push('Token: configurado (oculto)');
  lines.push(
    'Canais mapeados: ' +
      (mapped.length
        ? mapped
            .map(function (ch) {
              return (
                '#' +
                (ch.slackChannelName || ch.name) +
                ' (' +
                ch.slackChannelId +
                ')'
              );
            })
            .join(', ')
        : 'nenhum'),
  );

  try {
    var auth = slackApi_(token, 'auth.test', {});
    lines.push('auth.test: ok · bot @' + (auth.user || auth.bot_id || '—'));
    lines.push('team: ' + (auth.team || '—'));
  } catch (err) {
    return {
      ok: false,
      message:
        'Token inválido ou app sem permissão.\n\n' +
        (err.message || String(err)) +
        '\n\n' +
        lines.join('\n'),
    };
  }

  for (var i = 0; i < mapped.length; i++) {
    var ch = mapped[i];
    try {
      var history = slackApi_(token, 'conversations.history', {
        channel: ch.slackChannelId,
        limit: 5,
      });
      var count = (history.messages || []).length;
      lines.push(
        '#' +
          (ch.slackChannelName || ch.name) +
          ': ok · ' +
          count +
          ' msgs recentes (amostra)',
      );
    } catch (err) {
      lines.push(
        '#' +
          (ch.slackChannelName || ch.name) +
          ': ERRO · ' +
          (err.message || String(err)) +
          (String(err.message || '').indexOf('not_in_channel') >= 0
            ? ' → convide o bot no canal (/invite @bot)'
            : ''),
      );
    }
  }

  return {
    ok: true,
    message: 'Diagnóstico Slack\n\n' + lines.join('\n'),
  };
}

/** Reactions do ciclo JOOT (nome sem :) */
var JOOT_REACTIONS_ = {
  verificando: 'verificando-csi',
  jobdone: 'jobdone-csi',
  pendente: 'pendente-csi',
  negado: 'x-csi',
};

function addSlackReaction_(job, reactionName) {
  var token = getSlackBotToken_();
  if (!token || !job || !job.slack || !job.slack.channelId || !job.slack.messageTs) {
    return { ok: false, skipped: true };
  }
  try {
    slackApi_(token, 'reactions.add', {
      channel: job.slack.channelId,
      timestamp: normalizeSlackTsString_(job.slack.messageTs),
      name: reactionName,
    });
    return { ok: true, reaction: reactionName };
  } catch (err) {
    var msg = String((err && err.message) || err || '');
    if (msg.indexOf('already_reacted') >= 0) {
      return { ok: true, reaction: reactionName, already: true };
    }
    return { ok: false, error: msg };
  }
}

function postSlackThreadReply_(job, text) {
  var token = getSlackBotToken_();
  if (!token || !job || !job.slack || !job.slack.channelId || !job.slack.messageTs) {
    return { ok: false, skipped: true };
  }
  var body = String(text || '').trim();
  if (!body) return { ok: false, error: 'empty' };
  try {
    var res = slackApi_(token, 'chat.postMessage', {
      channel: job.slack.channelId,
      thread_ts: normalizeSlackTsString_(job.slack.threadTs || job.slack.messageTs),
      text: body,
      link_names: 1,
    });
    return { ok: true, ts: res.ts || null };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err || '') };
  }
}

function askerSlackMention_(job) {
  var sol = (job && job.solicitation) || {};
  if (sol.mentionUserId) return '<@' + sol.mentionUserId + '>';
  var handle = sol.slackHandle || job.asker || '';
  handle = String(handle || '').trim();
  if (!handle) return '@solicitante';
  if (handle.charAt(0) !== '@' && handle.charAt(0) !== '<') handle = '@' + handle;
  return handle;
}

function responderSlackMention_(token, email) {
  var normalized = normalizeEmail_(email);
  if (!normalized) return '@analista';
  try {
    var res = slackApi_(token, 'users.lookupByEmail', { email: normalized });
    if (res.user && res.user.id) return '<@' + res.user.id + '>';
  } catch (err) {}
  return '@' + String(normalized).split('@')[0];
}

function buildJobDoneThreadMessage_(job, analystEmail, answer) {
  var token = getSlackBotToken_();
  var asker = askerSlackMention_(job);
  var responder = responderSlackMention_(token, analystEmail);
  return asker + ' - ' + responder + ' disse: ' + String(answer || '').trim();
}

function buildPendenteThreadMessage_(job) {
  return askerSlackMention_(job) + ' — job pendente.';
}

function buildNegadoThreadMessage_(job, reason) {
  return (
    askerSlackMention_(job) +
    ' — job negado. Motivo: ' +
    String(reason || '').trim()
  );
}
