export type ContestPhase = 
  | 'CONFIGURACION' 
  | 'SORTEO' 
  | 'DEGUSTACION' 
  | 'VOTACION' 
  | 'GALA_TV' 
  | 'PODIO';

export type GalaStep = 'ESPERANDO' | 'REVELANDO_PUNTOS' | 'COMPLETO';

/**
 * How the admin reveals each jury's points during the gala:
 * - CLASICA:   every point one by one (up to the maximum), like before.
 * - DRAMATICA: the low points are delivered in one bulk click, then the top 3 are revealed one by one.
 * - MAXIMA:    the low points are delivered in one bulk click, then only the maximum is revealed.
 * - DIRECTA:   the whole vote of the juror is delivered in a single click.
 */
export type GalaMode = 'CLASICA' | 'DRAMATICA' | 'MAXIMA' | 'DIRECTA';

export type UserRole = 'superadmin' | 'participant' | 'tv';

export interface UserSession {
  role: UserRole;
  contestId: string;
  /** Member id (a person), not the team id. */
  participantId?: string;
}

/** A tapa cooked by a team of 1 to 3 members. It is the scoring unit. */
export interface Team {
  id: string;
  dishName: string;
  ingredients: string[];
  description: string;
  photoUrl?: string;
  tastingOrder: number; // Order drawn in the raffle (1, 2, 3...)
  tastingTime?: string; // Estimated time (e.g. "14:30")
}

/** A person: cooks in a team, has a personal PIN and casts one vote. */
export interface Member {
  id: string;
  name: string;
  pin: string; // 4-digit code (e.g. "1001")
  teamId: string;
}

export interface VoteRecord {
  voterId: string; // Member id
  voterName: string;
  scores: Record<string, number>; // teamId -> points (e.g. 9 down to 1)
  submittedAt: string;
}

export interface ScoreboardItem {
  teamId: string;
  name: string; // Team label built from its members ("Marta y Luis")
  dishName: string;
  photoUrl?: string;
  totalPoints: number;
  rank: number;
  previousRank?: number;
  highestPointsBreakdown: number[]; // Sorted descending list of points received, used for tie-breaking
}

export interface GalaState {
  currentVoterIndex: number;
  step: GalaStep;
  revealedTapaIds: string[]; // Teams whose points from the current voter are currently visible
  lastAwardedTapaId?: string; // For visual pulsing animation
  lastAwardedPoints?: number;
  lastBatchIds?: string[]; // Teams revealed in the last bulk ("reparto rápido") click
  /**
   * Reveal history for the current voter: one entry per click, each entry with the team ids
   * revealed in that click. Lets the admin undo a reveal. Optional for legacy documents.
   */
  history?: string[][];
}

export interface ContestState {
  id: string;
  title: string;
  code?: string; // Short human-friendly code, e.g. "TAPA26"
  phase: ContestPhase;
  adminPin: string;
  teams: Team[];
  members: Member[];
  votes: Record<string, VoteRecord>; // memberId -> VoteRecord
  activeTastingId?: string; // Team id shown in degustación mode
  gala: GalaState;
  galaMode?: GalaMode; // Defaults to CLASICA when missing (legacy contests)
  createdAt?: string;
  updatedAt: string;
}

export interface MultiContestData {
  activeContestId: string;
  contests: Record<string, ContestState>;
}

/** Lightweight contest info stored in `app_meta/registry`, used to list contests before they are loaded. */
export interface RemoteContestSummary {
  id: string;
  title: string;
  code?: string;
  phase?: ContestPhase;
  participantsCount?: number; // Number of people (members)
  updatedAt?: string;
}
