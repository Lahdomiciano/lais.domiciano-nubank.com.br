/**
 * API principal · Analista + Liderança + Dimensionamentos
 */

function getAppBootstrap(email) {
  var access = requireAnalyst_(email);
  var sync = getSyncStatus_();
  var linkStatus = getSpreadsheetLinkStatus_();
  return {
    access: access,
    channels: loadConfiguredChannels_(),
    analystDirectory: getAnalystDirectory_(),
    sync: sync,
    linkStatus: linkStatus,
    pendingCount: pendingCount_(),
    yearOptions: CONFIG.YEAR_OPTIONS,
    monthOptions: CONFIG.MONTH_OPTIONS.map(function (label, value) {
      return { value: value, label: label };
    }),
    weekdayOptions: CONFIG.WEEKDAY_OPTIONS,
    weekOptions: (function () {
      var out = [];
      for (var w = 1; w <= 52; w++) out.push({ value: w, label: 'Semana ' + w });
      return out;
    })(),
    dayOfMonthOptions: (function () {
      var out = [];
      for (var d = 1; d <= 31; d++) out.push({ value: d, label: String(d) });
      return out;
    })(),
    channelSlotCatalog: CONFIG.CHANNEL_SLOT_CATALOG,
    defaultYear: new Date().getFullYear(),
    defaultSheetName: CONFIG.HISTORICO_DIM_SHEET,
  };
}

function validateSession() {
  var identity = getGoogleIdentity();
  if (!identity.ok || !identity.email) {
    return {
      ok: false,
      error:
        'Não foi possível identificar sua conta Google. Abra o app logado no Google Nubank e autorize o acesso.',
    };
  }
  var access = resolveAccess_(identity.email);
  if (!access.canAccessAnalyst) {
    return {
      ok: false,
      error:
        'Conta não autorizada (' +
        identity.email +
        '). Cadastre-se na BD ou fale com a liderança.',
    };
  }
  return {
    ok: true,
    access: access,
    email: access.email,
    message: access.isXmart
      ? 'Acesso de Analista (Xmart · conta Google).'
      : access.canAccessLeadership
        ? 'Acesso completo: Analista + Liderança.'
        : 'Acesso de Analista.',
  };
}

function getJobsBundle(email) {
  requireAnalyst_(email);
  return {
    ok: true,
    jobs: getJobs_(),
    sync: getSyncStatus_(),
    pendingCount: pendingCount_(),
  };
}

function syncSlackJobs(email) {
  requireAnalyst_(email);
  var result = syncJobsFromSlack_(getJobs_());
  saveJobs_(result.jobs || []);
  saveSyncStatus_({
    mode: result.mode,
    lastSyncAt: result.lastSyncAt || nowIso_(),
    message: result.message,
    channels: result.channels || loadConfiguredChannels_(),
  });
  return getJobsBundle(email);
}

function resetDemoJobs(email) {
  requireLeadership_(email);
  resetDemoJobs_();
  return getJobsBundle(email);
}

function openJob(email, jobId) {
  requireAnalyst_(email);
  var job = findJob_(jobId);
  if (!job) throw new Error('Job não encontrado.');
  job.timeline = job.timeline || {};
  job.timeline.clickedAt = nowIso_();
  return upsertJob_(job);
}

function claimJob(email, jobId) {
  requireTreatAccess_(email);
  var job = findJob_(jobId);
  if (!job) throw new Error('Job não encontrado.');
  if (job.status !== 'pendente' && job.status !== 'sem_retorno') {
    throw new Error('Job não está disponível para iniciar.');
  }
  var analyst = normalizeEmail_(email);
  var at = nowIso_();

  var reaction = addSlackReaction_(job, JOOT_REACTIONS_.verificando);
  var notice = postSlackThreadReply_(
    job,
    '🔎 Job em verificação.',
  );

  job.status = 'em_atendimento';
  job.assignee = analyst;
  job.timeline = job.timeline || {};
  job.timeline.claimedAt = at;
  job.timeline.verifyingReactionAt = at;
  job.timeline.clickedAt = job.timeline.clickedAt || at;
  job.slack = job.slack || {};
  job.slack.reactions = job.slack.reactions || {};
  if (reaction && reaction.ok) {
    job.slack.reactions.verifying = JOOT_REACTIONS_.verificando;
  }
  job.slack.verifyingNoticeTs = (notice && notice.ts) || job.slack.verifyingNoticeTs;
  return upsertJob_(job);
}

function releaseJob(email, jobId) {
  requireTreatAccess_(email);
  var job = findJob_(jobId);
  if (!job) throw new Error('Job não encontrado.');
  var analyst = normalizeEmail_(email);
  if (job.status !== 'em_atendimento') {
    throw new Error('Só é possível devolver jobs em tratativa.');
  }
  if (job.assignee && normalizeEmail_(job.assignee) !== analyst) {
    throw new Error('Somente quem está em tratativa pode devolver o job.');
  }
  job.timeline = job.timeline || {};
  if (!job.timeline.skips) job.timeline.skips = [];
  job.timeline.skips.push({
    by: analyst,
    at: nowIso_(),
    startedAt: job.timeline.verifyingReactionAt || job.timeline.claimedAt || nowIso_(),
  });
  delete job.timeline.claimedAt;
  delete job.timeline.verifyingReactionAt;
  job.status = 'pendente';
  job.assignee = null;
  job.answer = null;
  return upsertJob_(job);
}

function completeJob(email, jobId, answer) {
  requireTreatAccess_(email);
  var job = findJob_(jobId);
  if (!job) throw new Error('Job não encontrado.');
  var text = String(answer || '').trim();
  if (!text) throw new Error('Informe a resposta.');
  var analyst = normalizeEmail_(email);
  var at = nowIso_();

  postSlackThreadReply_(job, buildJobDoneThreadMessage_(job, analyst, text));
  var reaction = addSlackReaction_(job, JOOT_REACTIONS_.jobdone);

  job.status = 'concluido';
  job.assignee = analyst;
  job.answer = text;
  job.timeline = job.timeline || {};
  job.timeline.finishedAt = at;
  job.timeline.repliedAt = at;
  if (reaction && reaction.ok) job.timeline.jobdoneReactionAt = at;
  job.slack = job.slack || {};
  job.slack.reactions = job.slack.reactions || {};
  if (reaction && reaction.ok) {
    job.slack.reactions.jobdone = JOOT_REACTIONS_.jobdone;
  }
  return upsertJob_(job);
}

function denyJob(email, jobId, reason) {
  requireTreatAccess_(email);
  var job = findJob_(jobId);
  if (!job) throw new Error('Job não encontrado.');
  var text = String(reason || '').trim();
  if (!text) throw new Error('Informe o motivo.');
  var analyst = normalizeEmail_(email);
  var at = nowIso_();

  postSlackThreadReply_(job, buildNegadoThreadMessage_(job, text));
  var reaction = addSlackReaction_(job, JOOT_REACTIONS_.negado);

  job.status = 'negado';
  job.assignee = analyst;
  job.timeline = job.timeline || {};
  job.timeline.deniedAt = at;
  job.timeline.deniedBy = analyst;
  job.timeline.denyReason = text;
  if (reaction && reaction.ok) job.timeline.deniedReactionAt = at;
  job.slack = job.slack || {};
  job.slack.reactions = job.slack.reactions || {};
  if (reaction && reaction.ok) {
    job.slack.reactions.denied = JOOT_REACTIONS_.negado;
  }
  return upsertJob_(job);
}

function markNoResponseJob(email, jobId) {
  requireTreatAccess_(email);
  var job = findJob_(jobId);
  if (!job) throw new Error('Job não encontrado.');
  var analyst = normalizeEmail_(email);
  var at = nowIso_();

  postSlackThreadReply_(job, buildPendenteThreadMessage_(job));
  var reaction = addSlackReaction_(job, JOOT_REACTIONS_.pendente);

  job.status = 'sem_retorno';
  job.assignee = analyst;
  job.timeline = job.timeline || {};
  job.timeline.noResponseAt = at;
  job.timeline.noResponseBy = analyst;
  if (reaction && reaction.ok) job.timeline.pendingReactionAt = at;
  job.slack = job.slack || {};
  job.slack.reactions = job.slack.reactions || {};
  if (reaction && reaction.ok) {
    job.slack.reactions.pending = JOOT_REACTIONS_.pendente;
  }
  return upsertJob_(job);
}

function getLeadershipBundle(email, tab, filters, analysts) {
  requireLeadership_(email);
  var allJobs = getJobs_();
  var scoped = scopeJobsByLeadershipTab_(allJobs, tab);
  var filtersNorm = filters || { year: new Date().getFullYear() };
  var periodJobs = applyLeadershipJobFilters_(scoped, filtersNorm);
  var yearJobs = scoped.filter(function (j) {
    return new Date(j.timeline.arrivedAt).getFullYear() === Number(filtersNorm.year);
  });
  var baseJobs = applyJobAnalystFilter_(periodJobs, analysts || []);
  var heatmapJobs = applyJobAnalystFilter_(
    applyLeadershipFiltersByCreatedAt_(scoped, filtersNorm),
    analysts || [],
  );
  var snapshot = buildLeadershipSnapshot_(baseJobs);
  var granularity = deriveLeadershipGranularity_(filtersNorm);
  var shared = countSharedChannelJobs_(baseJobs);
  return {
    ok: true,
    tab: tab || 'geral',
    volumeScopeLabel: leadershipVolumeScopeLabel_(tab),
    periodLines: buildLeadershipPeriodSummary_(filtersNorm, yearJobs),
    statusTiles: buildStatusTilesWithPct_(baseJobs),
    channelRows: tab === 'geral' ? channelVolumeRows_(baseJobs) : [],
    channelMetricBoard: buildChannelMetricBoard_(baseJobs),
    snapshot: snapshot,
    ranking: buildAnalystRanking_(baseJobs),
    throughput: buildThroughputSeries_(baseJobs, granularity),
    evolution: buildEvolutionSeries_(baseJobs, granularity),
    heatmapPeaks: buildHeatmapPeaks_(heatmapJobs),
    demandHeatmap: (function () {
      try {
        return buildDemandHeatmap_(heatmapJobs);
      } catch (err) {
        return { rows: [], total: 0, max: 0, hotSpot: null, peaks: [] };
      }
    })(),
    heatmapJobCount: heatmapJobs.length,
    sharedChannels: shared,
    cycleRows: buildCycleRows_(baseJobs, 12),
    granularity: granularity,
    jobCount: baseJobs.length,
    jobs: baseJobs,
    heatmapJobs: heatmapJobs,
    sync: getSyncStatus_(),
    linkStatus: getSpreadsheetLinkStatus_(),
  };
}

function getQualitativeBundle(email) {
  requireLeadership_(email);
  var jobs = getJobs_();
  var channels = loadConfiguredChannels_();
  var pendingByChannel = channels.map(function (ch) {
    var pending = jobs.filter(function (j) { return j.channelId === ch.id && j.status === 'pendente'; }).length;
    return {
      id: ch.id,
      name: channelSlackLabel_(ch),
      pending: pending,
      ownership: ch.ownership,
    };
  });
  return {
    ok: true,
    pendingCount: pendingCount_(),
    deniedCount: jobs.filter(function (j) { return j.status === 'negado'; }).length,
    noResponseCount: jobs.filter(function (j) { return j.status === 'sem_retorno'; }).length,
    pendingByChannel: pendingByChannel,
  };
}
