import { ContestPhase, ContestState, GalaMode, GalaState, Member, Team } from '../types/contest';

const PHASES: ContestPhase[] = ['CONFIGURACION', 'SORTEO', 'DEGUSTACION', 'VOTACION', 'GALA_TV', 'PODIO'];
const GALA_MODES: GalaMode[] = ['CLASICA', 'DRAMATICA', 'MAXIMA', 'DIRECTA'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function normalizeGala(raw: unknown): GalaState {
  const gala = (raw && typeof raw === 'object' ? raw : {}) as Partial<GalaState>;
  const revealed = Array.isArray(gala.revealedTapaIds)
    ? gala.revealedTapaIds.filter(isNonEmptyString)
    : [];
  const history = Array.isArray(gala.history)
    ? gala.history
        .filter(Array.isArray)
        .map((batch) => batch.filter(isNonEmptyString))
        .filter((batch) => batch.length > 0)
    : revealed.map((id) => [id]);

  return {
    currentVoterIndex:
      typeof gala.currentVoterIndex === 'number' && gala.currentVoterIndex >= 0
        ? gala.currentVoterIndex
        : 0,
    step:
      gala.step === 'REVELANDO_PUNTOS' || gala.step === 'COMPLETO' ? gala.step : 'ESPERANDO',
    revealedTapaIds: revealed,
    lastAwardedTapaId: isNonEmptyString(gala.lastAwardedTapaId) ? gala.lastAwardedTapaId : undefined,
    lastAwardedPoints: typeof gala.lastAwardedPoints === 'number' ? gala.lastAwardedPoints : undefined,
    lastBatchIds: Array.isArray(gala.lastBatchIds) ? gala.lastBatchIds.filter(isNonEmptyString) : [],
    history
  };
}

function normalizeTeam(raw: unknown, index: number): Team | null {
  if (!raw || typeof raw !== 'object') return null;
  const team = raw as Record<string, unknown>;
  if (!isNonEmptyString(team.id)) return null;
  return {
    id: team.id,
    dishName: asString(team.dishName),
    ingredients: Array.isArray(team.ingredients)
      ? team.ingredients.filter(isNonEmptyString)
      : [],
    description: asString(team.description),
    photoUrl: isNonEmptyString(team.photoUrl) ? team.photoUrl : undefined,
    tastingOrder:
      typeof team.tastingOrder === 'number' && team.tastingOrder > 0 ? team.tastingOrder : index + 1,
    tastingTime: isNonEmptyString(team.tastingTime) ? team.tastingTime : undefined
  };
}

function normalizeMember(raw: unknown): Member | null {
  if (!raw || typeof raw !== 'object') return null;
  const member = raw as Record<string, unknown>;
  if (!isNonEmptyString(member.id) || !isNonEmptyString(member.teamId)) return null;
  return {
    id: member.id,
    name: isNonEmptyString(member.name) ? member.name : 'Participante',
    pin: asString(member.pin),
    teamId: member.teamId
  };
}

/**
 * Normalizes any stored/cloud contest into the current team-based shape.
 * Legacy documents (one `participants` array = one person per tapa) are migrated by turning each
 * participant into a team with a single member, keeping the original id so votes, gala reveals and
 * `activeTastingId` references stay valid.
 */
export function normalizeContest(raw: unknown): ContestState | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (!isNonEmptyString(data.id)) return null;

  let teams: Team[] = [];
  let members: Member[] = [];

  if (Array.isArray(data.teams) && Array.isArray(data.members)) {
    teams = data.teams
      .map((team, index) => normalizeTeam(team, index))
      .filter((team): team is Team => team !== null);
    members = data.members
      .map((member) => normalizeMember(member))
      .filter((member): member is Member => member !== null);
  } else if (Array.isArray(data.participants)) {
    // Legacy shape: one participant = one person = one tapa.
    const legacy = data.participants as Record<string, unknown>[];
    teams = legacy
      .map((p, index) => normalizeTeam(p, index))
      .filter((team): team is Team => team !== null);
    members = legacy
      .map((p) => {
        if (!isNonEmptyString(p.id)) return null;
        return normalizeMember({ id: p.id, teamId: p.id, name: p.name, pin: p.pin });
      })
      .filter((member): member is Member => member !== null);
  } else {
    return null;
  }

  if (teams.length === 0) return null;

  const votes =
    data.votes && typeof data.votes === 'object'
      ? (data.votes as ContestState['votes'])
      : {};

  const phase = PHASES.includes(data.phase as ContestPhase)
    ? (data.phase as ContestPhase)
    : 'CONFIGURACION';

  const galaMode = GALA_MODES.includes(data.galaMode as GalaMode)
    ? (data.galaMode as GalaMode)
    : 'CLASICA';

  const activeTastingId =
    isNonEmptyString(data.activeTastingId) && teams.some((t) => t.id === data.activeTastingId)
      ? (data.activeTastingId as string)
      : teams[0].id;

  return {
    id: data.id,
    title: isNonEmptyString(data.title) ? data.title : 'Concurso de Tapas',
    code: isNonEmptyString(data.code) ? data.code : undefined,
    phase,
    adminPin: isNonEmptyString(data.adminPin) ? data.adminPin : '9999',
    teams,
    members,
    votes,
    activeTastingId,
    gala: normalizeGala(data.gala),
    galaMode,
    createdAt: isNonEmptyString(data.createdAt) ? data.createdAt : undefined,
    updatedAt: isNonEmptyString(data.updatedAt) ? data.updatedAt : new Date().toISOString()
  };
}
