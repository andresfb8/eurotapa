import { Member, Team, VoteRecord } from '../types/contest';
import { membersOfTeam, teamLabel } from './teams';

/** The single vote a team casts in the gala, built from the personal votes of its members. */
export interface JuryVote {
  teamId: string;
  name: string; // Team label ("Marta y Luis")
  scores: Record<string, number>; // rival teamId -> points (N-1 down to 1)
  memberCount: number;
  votedCount: number; // Members whose personal vote went into this jury vote
}

/**
 * Merges the personal votes of each team into one jury vote per tapa, so every tapa receives
 * exactly one vote from each rival tapa regardless of team sizes.
 *
 * For every rival the members' points are added up; rivals are then ranked by that sum and the
 * team hands out N-1 … 1 again. Ties: the rival with the highest individual scores wins, then the
 * one that was served first. Members who have not voted are left out; a team where nobody voted
 * casts no jury vote.
 */
export function buildJuryVotes(
  teams: Team[],
  members: Member[],
  votes: Record<string, VoteRecord>
): JuryVote[] {
  const juries: JuryVote[] = [];

  teams.forEach((team) => {
    const teamMembers = membersOfTeam(team.id, members);
    const memberVotes = teamMembers.flatMap((m) => (votes[m.id] ? [votes[m.id]] : []));
    if (memberVotes.length === 0) return;

    const ranked = teams
      .filter((rival) => rival.id !== team.id)
      .map((rival) => {
        const given = memberVotes.map((vote) => vote.scores[rival.id] ?? 0).sort((a, b) => b - a);
        return { rival, sum: given.reduce((acc, pts) => acc + pts, 0), given };
      })
      .sort((a, b) => {
        if (b.sum !== a.sum) return b.sum - a.sum;
        for (let i = 0; i < a.given.length; i++) {
          if (b.given[i] !== a.given[i]) return b.given[i] - a.given[i];
        }
        return a.rival.tastingOrder - b.rival.tastingOrder;
      });

    const scores: Record<string, number> = {};
    ranked.forEach((entry, index) => {
      scores[entry.rival.id] = ranked.length - index;
    });

    juries.push({
      teamId: team.id,
      name: teamLabel(team, members),
      scores,
      memberCount: teamMembers.length,
      votedCount: memberVotes.length
    });
  });

  return juries;
}
