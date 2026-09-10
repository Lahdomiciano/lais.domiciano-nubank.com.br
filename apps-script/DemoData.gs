/**
 * Canais JOOT + jobs demo (espelha server/demoData.mjs)
 */

var DEFAULT_CHANNELS = [
  {
    id: 'csi-gpd-me-ajuda',
    name: 'GPD Me Ajuda',
    slackChannelName: 'gpd-me-ajuda-teste',
    accent: 'purple',
    cluster: 'GPD',
    ownership: 'exclusive',
    treatment: 'Dúvidas operacionais de proteção digital: bloqueios, fraude digital, dispositivos, 2FA, chargeback.',
  },
  {
    id: 'incidentes-criticos-me-ajuda',
    name: 'IC Me Ajuda',
    slackChannelName: 'incidentes-críticos-me-ajuda',
    accent: 'teal',
    cluster: 'IC',
    ownership: 'exclusive',
    treatment: 'Escalações e playbooks de incidentes críticos: phishing, conta comprometida, contenção.',
  },
  {
    id: 'x-request',
    name: 'X-Request',
    slackChannelName: 'x-request',
    accent: 'blue',
    cluster: 'CSI/CSS',
    ownership: 'shared',
    treatment: 'Solicitações de outros squads pedindo ajuda ou tratativa do CSI/CSS.',
  },
  {
    id: 'gemini-ops-request',
    name: 'Gemini Ops',
    slackChannelName: 'gemini-ops-request',
    accent: 'green',
    cluster: 'CSI/CSS',
    ownership: 'shared',
    treatment: 'Triagem CSI/CSS + atendimento assistivo PCD em plataforma complementar.',
  },
  {
    id: 'ajuda-lossiano',
    name: 'Ajuda Lossiano',
    slackChannelName: 'ajuda-lossiano',
    accent: 'orange',
    cluster: 'CSI',
    ownership: 'exclusive',
    treatment: 'Receber pedido de fraude e executar ajuste financeiro conforme playbook Lossiano.',
  },
  {
    id: 'x-request-uv',
    name: 'X-Request UV',
    slackChannelName: 'x-request-uv',
    accent: 'purple',
    cluster: 'CSI/CSS',
    ownership: 'shared',
    treatment: 'Tratativa prioritária de clientes UV/high ticket direcionados ao CSI/CSS.',
  },
  {
    id: 'purple-phone-tickets',
    name: 'Purple Phone',
    slackChannelName: 'purple-phone-tickets',
    accent: 'blue',
    cluster: 'CSI/CSS',
    ownership: 'shared',
    treatment: 'Tickets internos (funcionário/rede) que pedem atuação do CSI/CSS.',
  },
];

function pad4_(n) {
  var s = String(n);
  while (s.length < 4) s = '0' + s;
  return s;
}

function hoursAgo_(h) {
  var d = new Date();
  d.setHours(d.getHours() - h);
  return d.toISOString();
}

function slackLinkFor_(channel, jobId) {
  var channelName = channel.slackChannelName || channel.id || channel.name;
  return {
    channelId: channel.slackChannelId || 'C_DEMO_' + channel.id,
    messageTs: String(Date.now() / 1000 - Math.random() * 100000),
    permalink:
      'https://nubank.slack.com/archives/' +
      channelName +
      '/p' +
      String(jobId).replace(/\W/g, ''),
  };
}

function channelTeamLabel_(channel) {
  return channel.slackChannelName || channel.id || channel.name;
}

function createDemoJobs_() {
  var jobs = [];
  var n = 1;
  var analysts = [
    'lais.domiciano@nubank.com.br',
    'bruno.oliveira@nubank.com.br',
    'camila.rocha@nubank.com.br',
    'diego.martins@nubank.com.br',
    'fernanda.dias@nubank.com.br',
  ];
  var samples = {
    'csi-gpd-me-ajuda': [
      { title: 'Bloqueio preventivo no exterior', question: 'GPD: cliente com bloqueio após compra no exterior. Qual fluxo de desbloqueio?', asker: 'ana.souza@nubank.com.br' },
      { title: 'Chargeback x fraude', question: 'CSI GPD: chargeback vai para fraude digital ou disputa comercial?', asker: 'joao.ferreira@nubank.com.br' },
      { title: '2FA em novo dispositivo', question: 'Cliente não recebe push do 2FA no aparelho novo. Playbook GPD?', asker: 'carla.mendes@nubank.com.br' },
      { title: 'App clonado suspeito', question: 'Indícios de app falso pedindo senha. Como orientar contenção?', asker: 'lucas.ribeiro@nubank.com.br' },
      { title: 'Cartão virtual não gera', question: 'Erro ao criar cartão virtual após troca de chip. Fluxo GPD?', asker: 'maria.lima@nubank.com.br' },
    ],
    'incidentes-criticos-me-ajuda': [
      { title: 'Phishing com senha compartilhada', question: 'IC: cliente compartilhou senha em golpe. Evidências antes de conter?', asker: 'maria.lima@nubank.com.br' },
      { title: 'Conta comprometida', question: 'Login em dispositivo não reconhecido + PIX atípico. Playbook?', asker: 'pedro.alves@nubank.com.br' },
      { title: 'Engenharia social via WhatsApp', question: 'Golpista se passou por Nu. Quais passos de contenção IC?', asker: 'beatriz.costa@nubank.com.br' },
      { title: 'Sequestro de sessão', question: 'Sessão web ativa em IP diferente + tentativa de crédito. Como agir?', asker: 'rafael.santos@nubank.com.br' },
    ],
    'x-request': [
      { title: 'Pedido cross-squad para CSI', question: 'Contas pedindo apoio CSI/CSS para restrição parcial.', asker: 'carla.mendes@nubank.com.br' },
      { title: 'Dúvida de roteamento', question: 'X-Request: esse caso é CSI ou só Contas? Preciso de confirmação.', asker: 'ana.souza@nubank.com.br' },
      { title: 'Apoio em chargeback interno', question: 'Time de disputas solicitando CSI/CSS para validar fraude.', asker: 'joao.ferreira@nubank.com.br' },
    ],
    'gemini-ops-request': [
      { title: 'Atendimento PCD visual', question: 'Cliente PCD visual precisa tratativa assistiva CSI/CSS.', asker: 'lucas.ribeiro@nubank.com.br' },
      { title: 'Triagem Gemini → CSI', question: 'Caso Gemini Ops com indício de comprometimento. Escalar CSI?', asker: 'pedro.alves@nubank.com.br' },
    ],
    'ajuda-lossiano': [
      { title: 'Ajuste financeiro pós-fraude', question: 'Fraude confirmou caso. Solicito ajuste Lossiano.', asker: 'beatriz.costa@nubank.com.br' },
      { title: 'Estorno parcial Lossiano', question: 'Cliente UV com estorno parcial aprovado. Como registrar no Lossiano?', asker: 'rafael.santos@nubank.com.br' },
      { title: 'Documentação de fraude', question: 'Quais evidências anexar antes do ajuste Lossiano?', asker: 'carla.mendes@nubank.com.br' },
    ],
    'x-request-uv': [
      { title: 'Cliente UV — contenção', question: 'X-Request UV para CSI: high ticket com suspeita de comprometimento.', asker: 'rafael.santos@nubank.com.br' },
      { title: 'UV — PIX atípico alto valor', question: 'Cliente UV com PIX fora do padrão. Priorizar CSI/CSS.', asker: 'ana.souza@nubank.com.br' },
    ],
    'purple-phone-tickets': [
      { title: 'Ticket rede Nu — CSI', question: 'Parente de funcionário precisa apoio CSI/CSS em bloqueio.', asker: 'interno.nu@nubank.com.br' },
      { title: 'Funcionário — conta familiar', question: 'Purple Phone: conta de familiar com golpe. Apoio CSI?', asker: 'interno.nu@nubank.com.br' },
    ],
  };

  function pushJob(partial) {
    var channel =
      catalogChannelById_(partial.channelId) ||
      DEFAULT_CHANNELS.filter(function (c) {
        return c.id === partial.channelId;
      })[0] ||
      DEFAULT_CHANNELS[0];
    var jobId = 'JOB-' + pad4_(n++);
    var job = {
      id: jobId,
      channelId: channel.id,
      team: channelTeamLabel_(channel),
      title: partial.title,
      question: partial.question,
      asker: partial.asker,
      askerEmail: partial.asker,
      createdAt: partial.arrivedAt,
      status: partial.status || 'pendente',
      timeline: partial.timeline || { arrivedAt: partial.arrivedAt },
      source: 'demo',
      routing: {
        ownership: channel.ownership,
        directedToCsiCss: true,
        cluster: channel.cluster,
      },
      slack: slackLinkFor_(channel, jobId),
    };
    if (partial.assignee) job.assignee = partial.assignee;
    if (partial.answer) job.answer = partial.answer;
    jobs.push(job);
    return job;
  }

  // Base: 1–2 pendentes por sample de cada canal
  DEFAULT_CHANNELS.forEach(function (channel) {
    (samples[channel.id] || []).forEach(function (sample, i) {
      pushJob({
        channelId: channel.id,
        title: sample.title,
        question: sample.question,
        asker: sample.asker,
        arrivedAt: hoursAgo_(2 + n + i),
        status: 'pendente',
      });
    });
  });

  // Em tratativa
  pushJob({
    channelId: 'csi-gpd-me-ajuda',
    title: 'Em tratativa — reset de dispositivo',
    question: 'GPD: cliente pediu reset após roubo de celular.',
    asker: 'ana.souza@nubank.com.br',
    arrivedAt: hoursAgo_(6),
    status: 'em_atendimento',
    assignee: analysts[0],
    timeline: {
      arrivedAt: hoursAgo_(6),
      clickedAt: hoursAgo_(5.5),
      claimedAt: hoursAgo_(5),
      verifyingReactionAt: hoursAgo_(5),
    },
  });
  pushJob({
    channelId: 'incidentes-criticos-me-ajuda',
    title: 'Em tratativa — phishing ativo',
    question: 'IC: links de phishing ainda abertos. Preciso de contenção.',
    asker: 'pedro.alves@nubank.com.br',
    arrivedAt: hoursAgo_(4),
    status: 'em_atendimento',
    assignee: analysts[1],
    timeline: {
      arrivedAt: hoursAgo_(4),
      claimedAt: hoursAgo_(3),
    },
  });
  pushJob({
    channelId: 'x-request-uv',
    title: 'Em tratativa — UV high ticket',
    question: 'X-Request UV: cliente VIP com bloqueio preventivo.',
    asker: 'rafael.santos@nubank.com.br',
    arrivedAt: hoursAgo_(3),
    status: 'em_atendimento',
    assignee: analysts[2],
    timeline: {
      arrivedAt: hoursAgo_(3),
      claimedAt: hoursAgo_(2),
    },
  });

  // Concluídos
  for (var c = 0; c < 6; c++) {
    var chDone = DEFAULT_CHANNELS[c % DEFAULT_CHANNELS.length];
    var sampleDone = (samples[chDone.id] || samples['csi-gpd-me-ajuda'])[0];
    pushJob({
      channelId: chDone.id,
      title: 'Concluído — ' + sampleDone.title,
      question: sampleDone.question,
      asker: sampleDone.asker,
      arrivedAt: hoursAgo_(30 + c * 5),
      status: 'concluido',
      assignee: analysts[c % analysts.length],
      answer: 'Respondido na thread com playbook do canal #' + channelTeamLabel_(chDone) + '.',
      timeline: {
        arrivedAt: hoursAgo_(30 + c * 5),
        claimedAt: hoursAgo_(29 + c * 5),
        repliedAt: hoursAgo_(28 + c * 5),
        finishedAt: hoursAgo_(28 + c * 5),
      },
    });
  }

  // Negados
  pushJob({
    channelId: 'x-request',
    title: 'Negado — fora do escopo CSI',
    question: 'X-Request mencionado CSI por engano — escopo de outro squad.',
    asker: 'rafael.santos@nubank.com.br',
    arrivedAt: hoursAgo_(14),
    status: 'negado',
    assignee: analysts[1],
    timeline: {
      arrivedAt: hoursAgo_(14),
      claimedAt: hoursAgo_(13),
      deniedAt: hoursAgo_(12),
      deniedBy: analysts[1],
      denyReason: 'Não direcionado / fora do escopo CSI-CSS',
    },
  });
  pushJob({
    channelId: 'gemini-ops-request',
    title: 'Negado — sem direcionamento CSI',
    question: 'Pedido genérico sem menção a CSI/CSS.',
    asker: 'lucas.ribeiro@nubank.com.br',
    arrivedAt: hoursAgo_(18),
    status: 'negado',
    assignee: analysts[3],
    timeline: {
      arrivedAt: hoursAgo_(18),
      claimedAt: hoursAgo_(17),
      deniedAt: hoursAgo_(16),
      deniedBy: analysts[3],
      denyReason: 'Sem direcionamento ao squad',
    },
  });

  // Sem retorno
  pushJob({
    channelId: 'ajuda-lossiano',
    title: 'Sem retorno — falta evidência',
    question: 'Lossiano: falta confirmação do time de fraude.',
    asker: 'beatriz.costa@nubank.com.br',
    arrivedAt: hoursAgo_(40),
    status: 'sem_retorno',
    assignee: analysts[2],
    timeline: {
      arrivedAt: hoursAgo_(40),
      claimedAt: hoursAgo_(38),
      noResponseAt: hoursAgo_(30),
      noResponseBy: analysts[2],
    },
  });
  pushJob({
    channelId: 'purple-phone-tickets',
    title: 'Sem retorno — aguardando dados',
    question: 'Purple Phone: solicitante não enviou protocolo.',
    asker: 'interno.nu@nubank.com.br',
    arrivedAt: hoursAgo_(22),
    status: 'sem_retorno',
    assignee: analysts[4],
    timeline: {
      arrivedAt: hoursAgo_(22),
      claimedAt: hoursAgo_(20),
      noResponseAt: hoursAgo_(16),
      noResponseBy: analysts[4],
    },
  });

  // Skipados (devolvidos à fila e ainda pendentes)
  pushJob({
    channelId: 'csi-gpd-me-ajuda',
    title: 'Skipado — retomada de fila',
    question: 'GPD: caso devolvido à fila para outro xmart.',
    asker: 'joao.ferreira@nubank.com.br',
    arrivedAt: hoursAgo_(9),
    status: 'pendente',
    timeline: {
      arrivedAt: hoursAgo_(9),
      claimedAt: hoursAgo_(8),
      skips: [
        { by: analysts[0], at: hoursAgo_(7), startedAt: hoursAgo_(8) },
        { by: analysts[1], at: hoursAgo_(6), startedAt: hoursAgo_(6.5) },
      ],
    },
  });
  pushJob({
    channelId: 'incidentes-criticos-me-ajuda',
    title: 'Skipado — handover IC',
    question: 'IC: handover após troca de turno.',
    asker: 'maria.lima@nubank.com.br',
    arrivedAt: hoursAgo_(11),
    status: 'pendente',
    timeline: {
      arrivedAt: hoursAgo_(11),
      skips: [{ by: analysts[2], at: hoursAgo_(10), startedAt: hoursAgo_(11) }],
    },
  });

  // Extra fila no canal de teste GPD (mesmo JOOT, nome de canal via config)
  for (var t = 0; t < 4; t++) {
    var gpdSamples = samples['csi-gpd-me-ajuda'];
    var gpdSample = gpdSamples[t % gpdSamples.length];
    pushJob({
      channelId: 'csi-gpd-me-ajuda',
      title: '[Demo] ' + gpdSample.title,
      question: gpdSample.question + ' (caso demo #' + (t + 1) + ')',
      asker: gpdSample.asker,
      arrivedAt: hoursAgo_(1 + t),
      status: 'pendente',
    });
  }

  return jobs;
}

function getDefaultChannels_() {
  return DEFAULT_CHANNELS;
}
