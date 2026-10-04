import { Member, Team } from '../types/contest';

/** Members that cook a given team / tapa. */
export function membersOfTeam(teamId: string, members: Member[]): Member[] {
  return members.filter((m) => m.teamId === teamId);
}

/**
 * Human label for a team used across TV, scoreboard and messages:
 * one member -> "Carlos"; two -> "Marta y Luis"; three -> "Ana, Luis y Marta".
 */
export function teamLabel(team: Team, members: Member[]): string {
  const names = membersOfTeam(team.id, members).map((m) => m.name);
  if (names.length === 0) return 'Equipo';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}
