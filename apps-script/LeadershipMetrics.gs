/**
 * Métricas de liderança · espelha leadershipMetrics.ts
 */

var SLA_FIRST_ACTION_SEC = 15 * 60;
var SLA_RESOLUTION_SEC = 4 * 60 * 60;

function jobStatusLabel_(status) {
  var map = {
    pendente: 'Aguardando atendimento',
    em_atendimento: 'Em tratativa',
    concluido: 'Concluído',
    sem_retorno: 'Pendente',
    negado: 'Negado',
  };
  return map[status] || status;
}

function jobEndAt_(job) {
  var t = job.timeline || {};
  return t.finishedAt || t.deniedAt || t.noResponseAt || null;
}

function firstActionAt_(job) {
  var t = job.timeline || {};
  return t.verifyingReactionAt || t.claimedAt || null;
}

function verificationAt_(job) {
  return firstActionAt_(job);
}

function diffSeconds_(start, end) {
  if (!start || !end) return null;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
}

function formatDurationSec_(sec) {
  if (sec === null || sec === undefined || !isFinite(sec)) return '—';
  var m = Math.floor(sec / 60);
  var s = Math.round(sec % 60);
  return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
}

function formatPct_(value) {
  if (value === null || !isFinite(value)) return '—';
  return value + '%';
}

function countByStatus_(jobs) {
  var base = { pendente: 0, em_atendimento: 0, concluido: 0, negado: 0, sem_retorno: 0 };
  jobs.forEach(function (j) { base[j.status] += 1; });
  return base;
}

function scopeJobsByLeadershipTab_(jobs, tab) {
  if (!tab || tab === 'geral' || tab === 'qualitativa' || tab === 'dimensionamentos') {
    return jobs;
  }
  return jobs.filter(function (j) { return j.channelId === tab; });
}

function leadershipVolumeScopeLabel_(tab) {
  if (!tab || tab === 'geral') return 'Todos os JOOTs CSI/CSS';
  if (tab === 'qualitativa') return 'Análise Qualitativa';
  if (tab === 'dimensionamentos') return 'Dimensionamentos';
  var channels = loadConfiguredChannels_();
  for (var i = 0; i < channels.length; i++) {
    if (channels[i].id === tab) return '#' + channelSlackLabel_(channels[i]);
  }
  return tab;
}

function hasLeadershipSubFilters_(filters) {
  if (!filters) return false;
  return Boolean(
    filters.dateStart ||
    filters.dateEnd ||
    (filters.months && filters.months.length) ||
    (filters.weeks && filters.weeks.length) ||
    (filters.weekdays && filters.weekdays.length) ||
    (filters.daysOfMonth && filters.daysOfMonth.length)
  );
}

function matchesLeadershipPeriod_(arrivedAt, filters) {
  if (!filters || !arrivedAt || isNaN(arrivedAt.getTime())) return false;
  if (arrivedAt.getFullYear() !== Number(filters.year)) return false;
  if (filters.dateStart && arrivedAt < parseFilterDate_(filters.dateStart)) return false;
  if (filters.dateEnd && arrivedAt > parseFilterDate_(filters.dateEnd, true)) return false;
  if (filters.weeks && filters.weeks.length) {
    var weeks = filters.weeks.map(function (w) { return Number(w); });
    if (getISOWeekYear_(arrivedAt) !== Number(filters.year)) return false;
    if (weeks.indexOf(getWeekNumber_(arrivedAt)) === -1) return false;
  }
  if (filters.months && filters.months.length) {
    var months = filters.months.map(function (m) { return Number(m); });
    if (months.indexOf(arrivedAt.getMonth()) === -1) return false;
  }
  if (filters.weekdays && filters.weekdays.length) {
    var weekdays = filters.weekdays.map(function (w) { return Number(w); });
    if (weekdays.indexOf(arrivedAt.getDay()) === -1) return false;
  }
  if (filters.daysOfMonth && filters.daysOfMonth.length) {
    var days = filters.daysOfMonth.map(function (d) { return Number(d); });
    if (days.indexOf(arrivedAt.getDate()) === -1) return false;
  }
  return true;
}

function jobCreatedAtDate_(job) {
  var raw =
    (job && job.createdAt) ||
    (job && job.timeline && job.timeline.arrivedAt) ||
    '';
  if (!raw) return null;
  var dt = new Date(raw);
  return isNaN(dt.getTime()) ? null : dt;
}

function applyLeadershipJobFilters_(jobs, filters) {
  if (!filters) return jobs;
  return jobs.filter(function (job) {
    return matchesLeadershipPeriod_(new Date(job.timeline.arrivedAt), filters);
  });
}

/** Mesmo recorte de período, mas pela data de criação do job (heatmap / picos). */
function applyLeadershipFiltersByCreatedAt_(jobs, filters) {
  if (!filters) return jobs || [];
  return (jobs || []).filter(function (job) {
    var dt = jobCreatedAtDate_(job);
    return dt ? matchesLeadershipPeriod_(dt, filters) : false;
  });
}

function deriveLeadershipGranularity_(filters) {
  if (!filters) return 'mensal';
  if (filters.dateStart && filters.dateEnd) {
    var days = (new Date(filters.dateEnd) - new Date(filters.dateStart)) / 86400000;
    if (days <= 14) return 'diario';
    if (days <= 90) return 'semanal';
    return 'mensal';
  }
  if ((filters.weekdays && filters.weekdays.length) || (filters.daysOfMonth && filters.daysOfMonth.length)) {
    return 'diario';
  }
  if (filters.weeks && filters.weeks.length) return 'semanal';
  if (filters.months && filters.months.length === 1) return 'semanal';
  return 'mensal';
}

function getJobAnalyst_(job) {
  var t = job.timeline || {};
  return job.assignee || t.deniedBy || t.noResponseBy || null;
}

function applyJobAnalystFilter_(jobs, analysts) {
  if (!analysts || !analysts.length) return jobs;
  var set = {};
  analysts.forEach(function (e) { set[e.toLowerCase()] = true; });
  return jobs.filter(function (job) {
    var a = getJobAnalyst_(job);
    return a && set[a.toLowerCase()];
  });
}

function closedJobs_(jobs) {
  return jobs.filter(function (j) {
    return j.status === 'concluido' || j.status === 'negado' || j.status === 'sem_retorno';
  });
}

function outcomeMix_(jobs) {
  var closed = closedJobs_(jobs);
  if (!closed.length) return { done: 0, pending: 0, denied: 0, total: 0 };
  var done = 0; var pending = 0; var denied = 0;
  closed.forEach(function (j) {
    if (j.status === 'concluido') done += 1;
    else if (j.status === 'sem_retorno') pending += 1;
    else if (j.status === 'negado') denied += 1;
  });
  return { done: done, pending: pending, denied: denied, total: closed.length };
}

function oldestPendingAgeSec_(jobs) {
  var pending = jobs.filter(function (j) { return j.status === 'pendente'; });
  if (!pending.length) return null;
  var oldest = pending[0];
  pending.forEach(function (j) {
    if (new Date(j.timeline.arrivedAt).getTime() < new Date(oldest.timeline.arrivedAt).getTime()) {
      oldest = j;
    }
  });
  return diffSeconds_(oldest.timeline.arrivedAt, nowIso_());
}

function quartiles_(values, metaSec) {
  if (!values.length) {
    return { q1: null, q2: null, q3: null, q4: null, mean: null, pctWithinMeta: null, sampleSize: 0 };
  }
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  var q = function (p) {
    var idx = (sorted.length - 1) * p;
    var lo = Math.floor(idx);
    var hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  var mean = sorted.reduce(function (s, v) { return s + v; }, 0) / sorted.length;
  var within = metaSec
    ? Math.round((sorted.filter(function (v) { return v <= metaSec; }).length / sorted.length) * 1000) / 10
    : null;
  return {
    q1: Math.round(q(0.25)),
    q2: Math.round(q(0.5)),
    q3: Math.round(q(0.75)),
    q4: Math.round(q(1)),
    mean: Math.round(mean),
    pctWithinMeta: within,
    sampleSize: sorted.length,
  };
}

function buildMetricRows_(jobs) {
  var sla = [];
  var done = [];
  var skips = [];
  var pending = [];
  var denied = [];
  jobs.forEach(function (j) {
    var t = j.timeline || {};
    var verify = verificationAt_(j);
    var slaSec = diffSeconds_(t.arrivedAt, verify);
    if (slaSec !== null) sla.push(slaSec);

    if (j.status === 'concluido') {
      var doneSec = diffSeconds_(verify, t.finishedAt);
      if (doneSec !== null) done.push(doneSec);
    }

    var skipList = t.skips || [];
    for (var s = 0; s < skipList.length; s++) {
      var skip = skipList[s];
      var started = skip.startedAt || verify;
      var skipSec = diffSeconds_(started, skip.at);
      if (skipSec !== null) skips.push(skipSec);
    }

    if (j.status === 'sem_retorno') {
      var pendSec = diffSeconds_(verify, t.noResponseAt);
      if (pendSec !== null) pending.push(pendSec);
    }

    if (j.status === 'negado') {
      var denSec = diffSeconds_(verify, t.deniedAt);
      if (denSec !== null) denied.push(denSec);
    }
  });

  return [
    { id: 'first-action', label: 'SLA (chegada → verificação)', stats: quartiles_(sla, SLA_FIRST_ACTION_SEC), metaLabel: '< 15 min' },
    { id: 'time-spent-done', label: 'Time Spent (Job finalizado)', stats: quartiles_(done, SLA_RESOLUTION_SEC), metaLabel: 'verificação → Job Done · < 4 h' },
    { id: 'time-spent-skip', label: 'Time Spent (Skip)', stats: quartiles_(skips), metaLabel: 'verificação → devolver à fila' },
    { id: 'time-spent-pending', label: 'Time Spent (Pendente)', stats: quartiles_(pending), metaLabel: 'verificação → Pendente' },
    { id: 'time-spent-denied', label: 'Time Spent (Negado)', stats: quartiles_(denied), metaLabel: 'verificação → Negado' },
  ];
}

function bucketLabel_(date, granularity) {
  if (granularity === 'diario') {
    return ('0' + date.getDate()).slice(-2) + '/' + ('0' + (date.getMonth() + 1)).slice(-2);
  }
  if (granularity === 'semanal') {
    return 'Sem ' + getWeekNumber_(date);
  }
  var months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return months[date.getMonth()] + ' ' + date.getFullYear();
}

function buildThroughputSeries_(jobs, granularity) {
  granularity = granularity || 'mensal';
  var entered = {};
  var closed = {};
  jobs.forEach(function (job) {
    var arrived = new Date(job.timeline.arrivedAt);
    var ek = bucketLabel_(arrived, granularity);
    entered[ek] = (entered[ek] || 0) + 1;
    var end = jobEndAt_(job);
    if (end) {
      var ck = bucketLabel_(new Date(end), granularity);
      closed[ck] = (closed[ck] || 0) + 1;
    }
  });
  var labels = {};
  Object.keys(entered).forEach(function (k) { labels[k] = true; });
  Object.keys(closed).forEach(function (k) { labels[k] = true; });
  return Object.keys(labels).map(function (label) {
    return { label: label, entraram: entered[label] || 0, fechados: closed[label] || 0 };
  });
}

function buildEvolutionSeries_(jobs, granularity) {
  granularity = granularity || 'mensal';
  var channels = loadConfiguredChannels_();
  var buckets = {};
  jobs.forEach(function (job) {
    var label = bucketLabel_(new Date(job.timeline.arrivedAt), granularity);
    if (!buckets[label]) buckets[label] = {};
    buckets[label][job.channelId] = (buckets[label][job.channelId] || 0) + 1;
  });
  var data = Object.keys(buckets).map(function (label) {
    var row = { label: label };
    var vals = buckets[label];
    Object.keys(vals).forEach(function (cid) { row[cid] = vals[cid]; });
    return row;
  });
  return { data: data, channels: channels };
}

function buildDemandHeatmap_(jobs) {
  var weekdayShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var weekdayFull = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  var dayOrder = [1, 2, 3, 4, 5, 6, 0];
  var grid = [];
  for (var d = 0; d < 7; d++) {
    grid[d] = [];
    for (var h = 0; h < 24; h++) grid[d][h] = 0;
  }

  (jobs || []).forEach(function (job) {
    var raw =
      job.createdAt ||
      (job.timeline && job.timeline.arrivedAt) ||
      '';
    if (!raw) return;
    var dt = new Date(raw);
    if (isNaN(dt.getTime())) return;
    grid[dt.getDay()][dt.getHours()] += 1;
  });

  var total = 0;
  var max = 0;
  var hotDi = 0;
  var hotHi = 0;
  for (var di = 0; di < 7; di++) {
    for (var hi = 0; hi < 24; hi++) {
      var n = grid[di][hi];
      total += n;
      if (n > max) {
        max = n;
        hotDi = di;
        hotHi = hi;
      }
    }
  }

  var rows = dayOrder.map(function (dayIndex) {
    return {
      dayIndex: dayIndex,
      dayShort: weekdayShort[dayIndex],
      dayFull: weekdayFull[dayIndex],
      hours: grid[dayIndex].slice(),
    };
  });

  var flat = [];
  for (var di2 = 0; di2 < 7; di2++) {
    for (var hi2 = 0; hi2 < 24; hi2++) {
      if (grid[di2][hi2] > 0) {
        flat.push({ di: di2, hi: hi2, count: grid[di2][hi2] });
      }
    }
  }
  flat.sort(function (a, b) {
    return b.count - a.count;
  });

  var peaks = flat.slice(0, 5).map(function (p) {
    var h1 = (p.hi < 10 ? '0' : '') + p.hi;
    var h2 = (p.hi + 1 < 10 ? '0' : '') + (p.hi + 1);
    return {
      day: weekdayFull[p.di],
      range: h1 + 'h–' + h2 + 'h',
      count: p.count,
    };
  });

  var hotSpot = null;
  if (max > 0 && total > 0) {
    var daysWithVolume = 0;
    for (var oi = 0; oi < dayOrder.length; oi++) {
      if (grid[dayOrder[oi]][hotHi] > 0) daysWithVolume += 1;
    }
    var pct = Math.round((max / total) * 1000) / 10;
    var hourLabel = (hotHi < 10 ? '0' : '') + hotHi + ':00';
    var insight =
      'Hot spot: ' +
      weekdayFull[hotDi] +
      ' às ' +
      hourLabel +
      ' com ' +
      max +
      ' acionamentos (' +
      pct +
      '% do total horário). Esse horário tem volume em ' +
      daysWithVolume +
      ' dia' +
      (daysWithVolume === 1 ? '' : 's') +
      ' diferente' +
      (daysWithVolume === 1 ? '' : 's') +
      ' da semana' +
      (daysWithVolume >= 5 ? ' — padrão consistente' : '') +
      '.';
    hotSpot = {
      dayIndex: hotDi,
      dayShort: weekdayShort[hotDi],
      dayFull: weekdayFull[hotDi],
      hour: hotHi,
      count: max,
      pct: pct,
      daysWithVolume: daysWithVolume,
      insight: insight,
    };
  }

  return {
    rows: rows,
    total: total,
    max: max,
    hotSpot: hotSpot,
    peaks: peaks,
  };
}

function buildHeatmapPeaks_(jobs) {
  return buildDemandHeatmap_(jobs).peaks;
}

function countSharedChannelJobs_(jobs) {
  var channels = loadConfiguredChannels_();
  var sharedIds = {};
  channels.forEach(function (ch) {
    if (ch.ownership === 'shared') sharedIds[ch.id] = true;
  });
  return {
    jobCount: jobs.filter(function (j) { return sharedIds[j.channelId]; }).length,
    channelCount: channels.filter(function (ch) { return ch.ownership === 'shared'; }).length,
  };
}

function buildCycleRows_(jobs, limit) {
  limit = limit || 12;
  return jobs
    .slice()
    .sort(function (a, b) {
      return new Date(b.timeline.arrivedAt) - new Date(a.timeline.arrivedAt);
    })
    .slice(0, limit)
    .map(function (job) {
      return {
        id: job.id,
        channel: job.team,
        status: job.status,
        arrivedAt: job.timeline.arrivedAt,
        firstActionAt: firstActionAt_(job),
        endAt: jobEndAt_(job),
        analyst: getJobAnalyst_(job) || '—',
      };
    });
}

function countSkipsInJobs_(jobs) {
  var total = 0;
  jobs.forEach(function (job) {
    var skips = (job.timeline && job.timeline.skips) || [];
    total += skips.length;
  });
  return total;
}

function countSkipsForAnalyst_(jobs, email) {
  var normalized = String(email || '').toLowerCase();
  var total = 0;
  jobs.forEach(function (job) {
    var skips = (job.timeline && job.timeline.skips) || [];
    skips.forEach(function (skip) {
      if (String(skip.by || '').toLowerCase() === normalized) total += 1;
    });
  });
  return total;
}

function calculateSkipPct_(jobs) {
  var skips = countSkipsInJobs_(jobs);
  if (!jobs.length) return null;
  return Math.round((skips / jobs.length) * 1000) / 10;
}

function buildLeadershipSnapshot_(jobs) {
  var statusCounts = countByStatus_(jobs);
  var channels = loadConfiguredChannels_();
  var topPending = null;
  channels.forEach(function (ch) {
    var count = jobs.filter(function (j) { return j.channelId === ch.id && j.status === 'pendente'; }).length;
    if (!topPending || count > topPending.count) {
      topPending = { name: channelSlackLabel_(ch), count: count };
    }
  });
  if (topPending && topPending.count === 0) topPending = null;
  return {
    statusCounts: statusCounts,
    backlog: statusCounts.pendente + statusCounts.em_atendimento,
    wip: statusCounts.em_atendimento,
    agingSec: oldestPendingAgeSec_(jobs),
    metricRows: buildMetricRows_(jobs),
    mix: outcomeMix_(jobs),
    absorption: jobs.length ? Math.round((closedJobs_(jobs).length / jobs.length) * 100) : null,
    throughput: closedJobs_(jobs).length,
    skipCount: countSkipsInJobs_(jobs),
    skipPct: calculateSkipPct_(jobs),
    topPendingChannel: topPending,
  };
}

function countSkippedAwaitingInJobs_(jobs) {
  return jobs.filter(function (job) {
    var skips = (job.timeline && job.timeline.skips) || [];
    return skips.length > 0 && job.status === 'pendente';
  }).length;
}

function channelVolumeRows_(jobs) {
  var channels = loadConfiguredChannels_();
  var rows = channels.map(function (ch) {
    var subset = jobs.filter(function (j) { return j.channelId === ch.id; });
    var counts = countByStatus_(subset);
    var total = counts.pendente + counts.em_atendimento + counts.concluido + counts.sem_retorno + counts.negado;
    return {
      channelId: ch.id,
      channel: '#' + channelSlackLabel_(ch),
      pendente: counts.pendente,
      em_atendimento: counts.em_atendimento,
      concluido: counts.concluido,
      sem_retorno: counts.sem_retorno,
      negado: counts.negado,
      skipados: countSkippedAwaitingInJobs_(subset),
      total: total,
    };
  });
  var totals = countByStatus_(jobs);
  rows.push({
    channelId: 'todos',
    channel: 'Total',
    pendente: totals.pendente,
    em_atendimento: totals.em_atendimento,
    concluido: totals.concluido,
    sem_retorno: totals.sem_retorno,
    negado: totals.negado,
    skipados: countSkippedAwaitingInJobs_(jobs),
    total: jobs.length,
  });
  return rows;
}

function buildChannelMetricBoard_(jobs) {
  var channels = loadConfiguredChannels_();
  var allMetrics = buildMetricRows_(jobs);
  var metricDefs = allMetrics.map(function (m) {
    return { id: m.id, label: m.label, metaLabel: m.metaLabel || '' };
  });
  var rows = channels.map(function (ch) {
    var subset = jobs.filter(function (j) { return j.channelId === ch.id; });
    var metricRows = buildMetricRows_(subset);
    var metrics = {};
    metricRows.forEach(function (m) { metrics[m.id] = m.stats; });
    return {
      channel: '#' + channelSlackLabel_(ch),
      metrics: metrics,
    };
  });
  if (channels.length > 1) {
    var totalMetrics = buildMetricRows_(jobs);
    var totalMap = {};
    totalMetrics.forEach(function (m) { totalMap[m.id] = m.stats; });
    rows.push({ channel: 'Total', metrics: totalMap });
  }
  return { metricDefs: metricDefs, rows: rows };
}

function buildStatusTilesWithPct_(jobs) {
  var counts = countByStatus_(jobs);
  var total = jobs.length || 1;
  return [
    { key: 'pendente', label: jobStatusLabel_('pendente'), count: counts.pendente, pct: Math.round((counts.pendente / total) * 1000) / 10 },
    { key: 'em_atendimento', label: jobStatusLabel_('em_atendimento'), count: counts.em_atendimento, pct: Math.round((counts.em_atendimento / total) * 1000) / 10 },
    { key: 'concluido', label: jobStatusLabel_('concluido'), count: counts.concluido, pct: Math.round((counts.concluido / total) * 1000) / 10 },
    { key: 'sem_retorno', label: jobStatusLabel_('sem_retorno'), count: counts.sem_retorno, pct: Math.round((counts.sem_retorno / total) * 1000) / 10 },
    { key: 'negado', label: jobStatusLabel_('negado'), count: counts.negado, pct: Math.round((counts.negado / total) * 1000) / 10 },
  ];
}

function buildAnalystRanking_(jobs) {
  var map = {};
  jobs.forEach(function (job) {
    var analyst = getJobAnalyst_(job);
    if (analyst) {
      if (!map[analyst]) map[analyst] = { analyst: analyst, treated: 0, done: 0, skips: 0 };
      map[analyst].treated += 1;
      if (job.status === 'concluido') map[analyst].done += 1;
    }
    var skips = (job.timeline && job.timeline.skips) || [];
    skips.forEach(function (skip) {
      var by = String(skip.by || '').toLowerCase();
      if (!by) return;
      if (!map[by]) map[by] = { analyst: by, treated: 0, done: 0, skips: 0 };
      map[by].skips += 1;
    });
  });
  return Object.keys(map)
    .map(function (k) {
      var row = map[k];
      row.donePct = row.treated ? Math.round((row.done / row.treated) * 1000) / 10 : 0;
      row.skipPct = jobs.length
        ? Math.round((row.skips / jobs.length) * 1000) / 10
        : null;
      return row;
    })
    .sort(function (a, b) { return b.treated - a.treated; })
    .slice(0, 5);
}
