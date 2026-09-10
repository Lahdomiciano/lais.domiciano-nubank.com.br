/**
 * Acesso · Analista + Liderança + Tratativa
 * Identidade = conta Google logada (web app executeAs: USER_ACCESSING).
 */

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function getLeadershipAllowlist_() {
  var raw =
    getScriptProps_().getProperty('LEADERSHIP_EMAILS') ||
    'lais.domiciano@nubank.com.br,lideranca.csi@nubank.com.br';
  return raw
    .split(',')
    .map(normalizeEmail_)
    .filter(function (e) { return Boolean(e); });
}

/**
 * E-mail da conta Google do visitante. Ignora valor digitado no cliente.
 */
function getTrustedUserEmail_(claimedEmail) {
  var active = normalizeEmail_(Session.getActiveUser().getEmail() || '');
  if (!active) {
    throw new Error(
      'Não foi possível identificar sua conta Google. Abra o app logado no Google Nubank e autorize o acesso.'
    );
  }
  var claimed = normalizeEmail_(claimedEmail || '');
  if (claimed && claimed !== active) {
    throw new Error(
      'Sessão inválida: o e-mail não corresponde à conta Google logada.'
    );
  }
  return active;
}

function getGoogleIdentity() {
  var email = normalizeEmail_(Session.getActiveUser().getEmail() || '');
  return {
    ok: Boolean(email),
    email: email,
  };
}

function resolveAccess_(email, actorId) {
  var normalized = normalizeEmail_(email);
  if (!normalized) {
    return {
      email: '',
      actorId: actorId || null,
      canAccessAnalyst: false,
      canAccessLeadership: false,
      canTreatJobs: false,
      isXmart: false,
      role: null,
    };
  }

  var isXpert = isXpertEmail_(normalized);
  var isXmart = isXmartEmail_(normalized) && !isXpert;
  var inAllowlist = getLeadershipAllowlist_().indexOf(normalized) >= 0;
  var inBd = isBdMember_(normalized);
  var canAnalyst = isXmartEmail_(normalized) || isXpert || inBd || inAllowlist;

  return {
    email: normalized,
    actorId: actorId || null,
    canAccessAnalyst: canAnalyst,
    canAccessLeadership: canAnalyst && !isXmartEmail_(normalized),
    canTreatJobs: canTreatJobs_(normalized),
    isXmart: isXmart,
    role: canAnalyst && !isXmart ? (isXpert ? 'xpert' : 'lideranca') : (isXmart ? 'analista' : null),
  };
}

function requireAnalyst_(claimedEmail) {
  var email = getTrustedUserEmail_(claimedEmail);
  var access = resolveAccess_(email);
  if (!access.canAccessAnalyst) {
    throw new Error(
      'Acesso restrito. Sua conta Google não está cadastrada na BD (Xmart / Xpert / liderança).'
    );
  }
  return access;
}

function isLeadershipOnlyInBd_(email) {
  var normalized = normalizeEmail_(email);
  if (!normalized) return true;
  if (isXmartEmail_(normalized) || isXpertEmail_(normalized)) return false;
  var roster = loadBdRoster_();
  return roster.leadership.indexOf(normalized) >= 0;
}

function requireTreatAccess_(claimedEmail) {
  var access = requireAnalyst_(claimedEmail);
  if (isLeadershipOnlyInBd_(access.email)) {
    throw new Error('Sem permissão para tratar jobs.');
  }
  return access;
}

function requireLeadership_(claimedEmail) {
  var email = getTrustedUserEmail_(claimedEmail);
  var access = resolveAccess_(email);
  if (!access.canAccessLeadership) {
    throw new Error('Acesso à visão Liderança restrito. Xmarts não acessam esta aba.');
  }
  return access;
}
