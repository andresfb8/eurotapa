import { Member, Team, VoteMode, VoteModeSetting, VoteRecord } from '../types/contest';
import { membersOfTeam, teamLabel } from './teams';

/** One jury of the gala: a person (individual voting) or a whole team (combined voting). */
export interface JuryVote {
  /** Member id in individual voting, team id in combined voting. */
  id: string;
  teamId: string;
  name: string; // Person name, or team label ("Marta y Luis")
  scores: Record<string, number>; // rival teamId -> points (N-1 down to 1)
  memberCount: number;
  votedCount: number; // Members whose personal vote went into this jury vote
}

/** True when every tapa is cooked by the same number of people. */
export function teamsAreEvenlySized(teams: Team[], members: Member[]): boolean {
  const sizes = new Set(teams.map((team) => membersOfTeam(team.id, members).length));
  return sizes.size <= 1;
}

/**
 * How votes count. With teams of the same size every tapa already receives the same number of
 * votes, so each person is a jury. With uneven teams a big team would receive fewer votes than a
 * solo cook, so each team casts one combined vote instead. The organizer can force either.
 */
export function effectiveVoteMode(teams: Team[], members: Member[], setting?: VoteModeSetting): VoteMode {
  if (setting === 'individual' || setting === 'team') return setting;
  return teamsAreEvenlySized(teams, members) ? 'individual' : 'team';
}

/**
 * Juries of the gala, in reveal order.
 *
 * Individual: one jury per person who voted, with their vote as it is.
 *
 * Team: the personal votes of each team are merged into one vote per tapa. For every rival the
 * members' points are added up; rivals are then ranked by that sum and the team hands out
 * N-1 … 1 again. Ties: the rival with the highest individual scores wins, then the one that was
 * served first. Members who have not voted are left out; a team where nobody voted casts no vote.
 */
export function buildJuryVotes(
  teams: Team[],
  members: Member[],
  votes: Record<string, VoteRecord>,
  mode: VoteMode
): JuryVote[] {
  if (mode === 'individual') {
    return members.flatMap((member) => {
      const vote = votes[member.id];
      if (!vote) return [];
      // Only tapas that still exist and are not the voter's own
      const scores: Record<string, number> = {};
      teams.forEach((team) => {
        if (team.id !== member.teamId && vote.scores[team.id] !== undefined) {
          scores[team.id] = vote.scores[team.id];
        }
      });
      return [{ id: member.id, teamId: member.teamId, name: member.name, scores, memberCount: 1, votedCount: 1 }];
    });
  }

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
      id: team.id,
      teamId: team.id,
      name: teamLabel(team, members),
      scores,
      memberCount: teamMembers.length,
      votedCount: memberVotes.length
    });
  });

  return juries;
}
