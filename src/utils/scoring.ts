import { Participant, VoteRecord, ScoreboardItem, GalaState } from '../types/contest';

/**
 * Calculates Eurovision standings with tie-breaking rules.
 * Tie-breaker: If totalPoints are equal, compare descending scores awarded (who got more 14s, 13s, etc.)
 */
export function calculateScoreboard(
  participants: Participant[],
  votes: Record<string, VoteRecord>,
  galaFilter?: { currentVoterIndex: number; activeVotersList: Participant[]; galaState: GalaState }
): ScoreboardItem[] {
  // Map of scores received per participant
  const receivedScoresMap: Record<string, number[]> = {};
  const totalPointsMap: Record<string, number> = {};

  participants.forEach((p) => {
    receivedScoresMap[p.id] = [];
    totalPointsMap[p.id] = 0;
  });

  // Determine which votes are counted
  if (!galaFilter) {
    // Normal full count: include all registered votes
    Object.values(votes).forEach((vote) => {
      Object.entries(vote.scores).forEach(([targetId, points]) => {
        if (totalPointsMap[targetId] !== undefined) {
          totalPointsMap[targetId] += points;
          receivedScoresMap[targetId].push(points);
        }
      });
    });
  } else {
    // Live Gala reveal count:
    const { currentVoterIndex, activeVotersList, galaState } = galaFilter;

    // 1. All voters prior to currentVoterIndex have their full points counted
    for (let i = 0; i < currentVoterIndex; i++) {
      const pastVoter = activeVotersList[i];
      if (!pastVoter) continue;
      const vote = votes[pastVoter.id];
      if (vote) {
        Object.entries(vote.scores).forEach(([targetId, points]) => {
          if (totalPointsMap[targetId] !== undefined) {
            totalPointsMap[targetId] += points;
            receivedScoresMap[targetId].push(points);
          }
        });
      }
    }

    // 2. Current voter only counts points that have been revealed so far
    const currentVoter = activeVotersList[currentVoterIndex];
    if (currentVoter) {
      const vote = votes[currentVoter.id];
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
  }

  // Build ScoreboardItem array
  const items: ScoreboardItem[] = participants.map((p) => {
    const scores = (receivedScoresMap[p.id] || []).sort((a, b) => b - a);
    return {
      participantId: p.id,
      name: p.name,
      dishName: p.dishName,
      photoUrl: p.photoUrl,
      totalPoints: totalPointsMap[p.id] || 0,
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

    // 3. Fallback: alphabetical
    return a.dishName.localeCompare(b.dishName);
  });

  // Assign 1-indexed ranks
  return items.map((item, index) => ({
    ...item,
    rank: index + 1
  }));
}
