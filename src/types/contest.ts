export type ContestPhase = 
  | 'CONFIGURACION' 
  | 'SORTEO' 
  | 'DEGUSTACION' 
  | 'VOTACION' 
  | 'GALA_TV' 
  | 'PODIO';

export type GalaStep = 'ESPERANDO' | 'REVELANDO_PUNTOS' | 'COMPLETO';

export type UserRole = 'superadmin' | 'participant' | 'tv';

export interface UserSession {
  role: UserRole;
  contestId: string;
  participantId?: string;
}

export interface Participant {
  id: string;
  name: string;
  pin: string; // 4-digit code (e.g. "1001")
  dishName: string;
  ingredients: string[];
  description: string;
  photoUrl?: string;
  tastingOrder: number; // Order drawn in the raffle (1, 2, 3...)
  tastingTime?: string; // Estimated time (e.g. "14:30")
}

export interface VoteRecord {
  voterId: string;
  voterName: string;
  scores: Record<string, number>; // participantId -> points (e.g. 14 down to 1)
  submittedAt: string;
}

export interface ScoreboardItem {
  participantId: string;
  name: string;
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
  revealedTapaIds: string[]; // tapas whose points from the current voter are currently visible
  lastAwardedTapaId?: string; // For visual pulsing animation
  lastAwardedPoints?: number;
}

export interface ContestState {
  id: string;
  title: string;
  code?: string; // Short human-friendly code, e.g. "TAPA26"
  phase: ContestPhase;
  adminPin: string;
  participants: Participant[];
  votes: Record<string, VoteRecord>; // voterId -> VoteRecord
  activeTastingId?: string; // For degustación mode
  gala: GalaState;
  createdAt?: string;
  updatedAt: string;
}

export interface MultiContestData {
  activeContestId: string;
  contests: Record<string, ContestState>;
}
