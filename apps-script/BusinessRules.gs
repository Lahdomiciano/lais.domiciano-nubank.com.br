/**
 * Regras de negócio · espelham leadershipMetrics.ts e dimensionamentosMetrics.ts
 */

function normalizeSlotToken_(value) {
  return String(value || '').trim().toLowerCase();
}

function slotTokensForChannel_(channelId) {
  var all = getAllSlotTokens_();
  if (!channelId || channelId === 'all') return all;
  for (var i = 0; i < CONFIG.CHANNEL_SLOT_CATALOG.length; i++) {
    var entry = CONFIG.CHANNEL_SLOT_CATALOG[i];
    if (entry.channelId === channelId) return [entry.slotToken];
  }
  return all;
}

function slotLabelForChannel_(channelId) {
  if (!channelId || channelId === 'all') return 'Todos os JOOTs';
  for (var i = 0; i < CONFIG.CHANNEL_SLOT_CATALOG.length; i++) {
    var entry = CONFIG.CHANNEL_SLOT_CATALOG[i];
    if (entry.channelId === channelId) {
      return '#' + entry.slackName + ' · ' + entry.label;
    }
  }
  return channelId;
}

function slotLabelForToken_(token) {
  var normalized = normalizeSlotToken_(token);
  for (var i = 0; i < CONFIG.CHANNEL_SLOT_CATALOG.length; i++) {
    var entry = CONFIG.CHANNEL_SLOT_CATALOG[i];
    if (normalizeSlotToken_(entry.slotToken) === normalized) return entry.label;
  }
  return String(token).toUpperCase();
}

function parseFilterDate_(isoDate, endOfDay) {
  if (endOfDay) return new Date(isoDate + 'T23:59:59.999');
  return new Date(isoDate + 'T00:00:00');
}

function getWeekNumber_(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getISOWeekYear_(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

function formatFilterDateBr_(iso) {
  var parts = iso.split('-');
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function buildLeadershipPeriodSummary_(filters, jobsInYear) {
  var lines = [];
  var hasSub = hasLeadershipSubFilters_(filters);

  if (!hasSub) {
    lines.push('Ano ' + filters.year);
    if (jobsInYear && jobsInYear.length) {
      var monthSet = {};
      jobsInYear.forEach(function (job) {
        var d = new Date(job.timeline.arrivedAt);
        if (d.getFullYear() === Number(filters.year)) monthSet[d.getMonth()] = true;
      });
      var sorted = Object.keys(monthSet).map(Number).sort(function (a, b) { return a - b; });
      if (sorted.length === 12) {
        lines.push('Todos os meses');
      } else if (sorted.length) {
        lines.push(sorted.map(function (m) {
          return CONFIG.MONTH_OPTIONS[m].slice(0, 3);
        }).join(', '));
      } else {
        lines.push('Todos os meses');
      }
    } else {
      lines.push('Todos os meses');
    }
    return lines;
  }

  lines.push('Ano ' + filters.year);
  var months = filters.months || [];

  if (months.length === 1) {
    lines.push(CONFIG.MONTH_OPTIONS[months[0]]);
  } else if (months.length > 1) {
    lines.push(
      months.slice().sort(function (a, b) { return a - b; }).map(function (m) {
        return CONFIG.MONTH_OPTIONS[m];
      }).join(', ')
    );
  }

  var weeks = filters.weeks || [];
  if (weeks.length === 1) lines.push('Semana ' + weeks[0]);
  else if (weeks.length > 1) {
    lines.push('Semanas ' + weeks.slice().sort(function (a, b) { return a - b; }).join(', '));
  }

  var weekdays = filters.weekdays || [];
  if (weekdays.length === 1) {
    lines.push(CONFIG.WEEKDAY_OPTIONS[weekdays[0]].label);
  } else if (weekdays.length > 1) {
    lines.push(
      weekdays.slice().sort(function (a, b) { return a - b; }).map(function (w) {
        return CONFIG.WEEKDAY_OPTIONS[w].label;
      }).join(', ')
    );
  }

  var daysOfMonth = filters.daysOfMonth || [];
  if (daysOfMonth.length === 1) lines.push('Dia ' + daysOfMonth[0]);
  else if (daysOfMonth.length > 1) {
    lines.push('Dias ' + daysOfMonth.slice().sort(function (a, b) { return a - b; }).join(', '));
  }

  if (filters.dateStart && filters.dateEnd) {
    lines.push(formatFilterDateBr_(filters.dateStart) + ' a ' + formatFilterDateBr_(filters.dateEnd));
  } else if (filters.dateStart) {
    lines.push('A partir de ' + formatFilterDateBr_(filters.dateStart));
  } else if (filters.dateEnd) {
    lines.push('Até ' + formatFilterDateBr_(filters.dateEnd));
  }

  return lines;
}

function matchesDimensionamentoPeriod_(row, filters) {
  return matchesLeadershipPeriod_(new Date(row.date + 'T12:00:00'), filters);
}

function applyDimensionamentoFilters_(rows, filters) {
  return rows.filter(function (row) {
    return matchesDimensionamentoPeriod_(row, filters);
  });
}

function applyAnalystFilter_(rows, analysts) {
  if (!analysts || !analysts.length) return rows;
  var set = {};
  analysts.forEach(function (email) { set[email.toLowerCase()] = true; });
  return rows.filter(function (row) {
    return set[row.agent.toLowerCase()];
  });
}

function countSlotsForTokens_(row, slotTokens) {
  var allowed = {};
  slotTokens.forEach(function (t) { allowed[normalizeSlotToken_(t)] = true; });
  var count = 0;
  var slots = row.slots || {};
  Object.keys(slots).forEach(function (key) {
    if (allowed[normalizeSlotToken_(slots[key])]) count += 1;
  });
  return count;
}

function countSlotsByToken_(row) {
  var counts = {};
  getAllSlotTokens_().forEach(function (token) { counts[token] = 0; });
  Object.keys(row.slots || {}).forEach(function (key) {
    var normalized = normalizeSlotToken_(row.slots[key]);
    if (counts.hasOwnProperty(normalized)) counts[normalized] += 1;
  });
  return counts;
}

function aggregateDimensionamentoByXmart_(rows, slotTokens) {
  var map = {};

  rows.forEach(function (row) {
    var agent = row.agent.toLowerCase();
    var slots = countSlotsForTokens_(row, slotTokens);
    if (slots <= 0) return;

    if (!map[agent]) {
      map[agent] = {
        agent: agent,
        slotCount: 0,
        days: {},
        byToken: {},
      };
      getAllSlotTokens_().forEach(function (token) { map[agent].byToken[token] = 0; });
    }

    var byToken = countSlotsByToken_(row);
    map[agent].slotCount += slots;
    map[agent].days[row.date] = true;
    slotTokens.forEach(function (token) {
      map[agent].byToken[token] = (map[agent].byToken[token] || 0) + byToken[token];
    });
  });

  var summaries = Object.keys(map).map(function (key) {
    var item = map[key];
    var daysScheduled = Object.keys(item.days).length;
    return {
      agent: item.agent,
      slotCount: item.slotCount,
      daysScheduled: daysScheduled,
      avgSlotsPerDay: daysScheduled ? Math.round((item.slotCount / daysScheduled) * 10) / 10 : 0,
      byToken: item.byToken,
    };
  });

  summaries.sort(function (a, b) { return b.slotCount - a.slotCount; });

  var totalSlots = summaries.reduce(function (sum, row) { return sum + row.slotCount; }, 0);
  summaries.forEach(function (row) {
    row.pctOfTotal = totalSlots
      ? Math.round((row.slotCount / totalSlots) * 1000) / 10
      : 0;
  });

  return summaries;
}

function aggregateDimensionamentoTotals_(rows, slotTokens) {
  var summaries = aggregateDimensionamentoByXmart_(rows, slotTokens);
  var totalSlots = summaries.reduce(function (sum, row) { return sum + row.slotCount; }, 0);
  var days = {};
  rows.forEach(function (row) {
    if (countSlotsForTokens_(row, slotTokens) > 0) days[row.date] = true;
  });
  var scheduledDays = Object.keys(days).length;
  var xmartsWithSlots = summaries.length;

  var byToken = {};
  getAllSlotTokens_().forEach(function (token) {
    byToken[token] = summaries.reduce(function (sum, row) {
      return sum + (row.byToken[token] || 0);
    }, 0);
  });

  return {
    totalSlots: totalSlots,
    xmartsWithSlots: xmartsWithSlots,
    scheduledDays: scheduledDays,
    avgSlotsPerXmart: xmartsWithSlots ? Math.round((totalSlots / xmartsWithSlots) * 10) / 10 : 0,
    avgSlotsPerDay: scheduledDays ? Math.round((totalSlots / scheduledDays) * 10) / 10 : 0,
    byToken: byToken,
  };
}
