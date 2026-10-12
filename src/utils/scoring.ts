import { Member, Team, VoteRecord, ScoreboardItem, GalaState } from '../types/contest';
import { teamLabel } from './teams';
import { buildJuryVotes } from './juries';

/**
 * Calculates Eurovision standings with tie-breaking rules.
 * Points come from the jury vote of each team (the combined vote of its members), not from each person.
 * Tie-breaker: If totalPoints are equal, compare descending scores awarded (who got more 9s, 8s, etc.)
 * Tapas that are still level on every score share the same position (1º, 1º, 3º...).
 */
export function calculateScoreboard(
  teams: Team[],
  members: Member[],
  votes: Record<string, VoteRecord>,
  galaFilter?: { currentVoterIndex: number; galaState: GalaState }
): ScoreboardItem[] {
  // Map of scores received per team
  const receivedScoresMap: Record<string, number[]> = {};
  const totalPointsMap: Record<string, number> = {};

  teams.forEach((t) => {
    receivedScoresMap[t.id] = [];
    totalPointsMap[t.id] = 0;
  });

  const juries = buildJuryVotes(teams, members, votes);

  // Determine which votes are counted
  if (!galaFilter) {
    // Normal full count: include every jury vote
    juries.forEach((vote) => {
      Object.entries(vote.scores).forEach(([targetId, points]) => {
        if (totalPointsMap[targetId] !== undefined) {
          totalPointsMap[targetId] += points;
          receivedScoresMap[targetId].push(points);
        }
      });
    });
  } else {
    // Live Gala reveal count:
    const { currentVoterIndex, galaState } = galaFilter;

    // 1. All juries prior to currentVoterIndex have their full points counted
    for (let i = 0; i < currentVoterIndex; i++) {
      const vote = juries[i];
      if (vote) {
        Object.entries(vote.scores).forEach(([targetId, points]) => {
          if (totalPointsMap[targetId] !== undefined) {
            totalPointsMap[targetId] += points;
            receivedScoresMap[targetId].push(points);
          }
        });
      }
    }

    // 2. Current jury only counts points that have been revealed so far
    const vote = juries[currentVoterIndex];
    if (vote) {
      Object.entries(vote.scores).forEach(([targetId, points]) => {
        if (galaState.revealedTapaIds.includes(targetId)) {
          if (totalPointsMap[targetId] !== undefined) {
            totalPointsMap[targetId] += points;
            receivedScoresMap[targetId].push(points);
          }
        }
      });
    }
  }

  // Build ScoreboardItem array
  const items: ScoreboardItem[] = teams.map((team) => {
    const scores = (receivedScoresMap[team.id] || []).sort((a, b) => b - a);
    return {
      teamId: team.id,
      name: teamLabel(team, members),
      dishName: team.dishName,
      photoUrl: team.photoUrl,
      totalPoints: totalPointsMap[team.id] || 0,
      rank: 0,
      highestPointsBreakdown: scores
    };
  });

  // Sort according to Eurovision rules
  items.sort((a, b) => {
    // 1. Total points descending
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }

    // 2. Tie-break: compare highest points breakdown
    const maxLength = Math.max(a.highestPointsBreakdown.length, b.highestPointsBreakdown.length);
    for (let i = 0; i < maxLength; i++) {
      const scoreA = a.highestPointsBreakdown[i] || 0;
      const scoreB = b.highestPointsBreakdown[i] || 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
    }

    // 3. Full tie: they share the position, alphabetical only decides who is listed first
    return a.dishName.localeCompare(b.dishName);
  });

  // Assign 1-indexed ranks. Fully tied tapas share the position; tapas without points yet are
  // simply listed in order, so the board does not open with everybody in first place.
  const ranked: ScoreboardItem[] = [];
  items.forEach((item, index) => {
    const previous = ranked[index - 1];
    const sharesPosition =
      !!previous &&
      item.totalPoints > 0 &&
      item.totalPoints === previous.totalPoints &&
      item.highestPointsBreakdown.length === previous.highestPointsBreakdown.length &&
      item.highestPointsBreakdown.every((pts, i) => pts === previous.highestPointsBreakdown[i]);
    ranked.push({ ...item, rank: sharesPosition ? previous.rank : index + 1 });
  });
  return ranked;
}
