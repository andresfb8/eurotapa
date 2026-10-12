import { CSSProperties, useMemo } from 'react';
import { GalaMode, GalaState, Member, Team, VoteMode, VoteRecord, ContestPhase } from '../../types/contest';
import { calculateScoreboard } from '../../utils/scoring';
import { teamLabel } from '../../utils/teams';
import { buildJuryVotes } from '../../utils/juries';
import { ScoreboardList } from './ScoreboardList';
import { PodiumView } from './PodiumView';
import { ArrowRightIcon, BoltIcon, CrownIcon } from '../Icons';
import { Confetti } from '../Confetti';
import { FullscreenButton } from '../tv/TVShell';
import tv from '../tv/TVStage.module.css';
import styles from './GalaTVView.module.css';

interface GalaTVViewProps {
  teams: Team[];
  members: Member[];
  votes: Record<string, VoteRecord>;
  gala: GalaState;
  phase: ContestPhase;
  galaMode?: GalaMode;
  /** Whether each person or each team is a jury. */
  voteMode: VoteMode;
  /** False on the public TV screen: reveals are driven only from the admin console. */
  canControl: boolean;
  onNextGalaStep: () => void;
  onUndoGalaStep: () => void;
  onRestart: () => void;
}

/** Above this many tapas the scoreboard splits in two columns so rows stay readable. */
const SINGLE_COLUMN_MAX = 10;

export function GalaTVView({
  teams,
  members,
  votes,
  gala,
  phase,
  galaMode,
  voteMode,
  canControl,
  onNextGalaStep,
  onUndoGalaStep,
  onRestart
}: GalaTVViewProps) {
  // Juries: every person who voted, or one combined vote per tapa
  const votersList = useMemo(
    () => buildJuryVotes(teams, members, votes, voteMode),
    [teams, members, votes, voteMode]
  );

  const currentVoter = votersList[gala.currentVoterIndex];
  const currentVoterTeam = currentVoter
    ? teams.find((team) => team.id === currentVoter.teamId)
    : undefined;

  // Real-time animated scoreboard based on current reveal progress
  const scoreboard = useMemo(() => {
    return calculateScoreboard(teams, members, votes, voteMode, {
      currentVoterIndex: gala.currentVoterIndex,
      galaState: gala
    });
  }, [teams, members, votes, voteMode, gala]);

  // Votes from the current jury in ASCENDING order (1 pt, 2 pts, ..., max pts).
  // This hook must run on every render, before the podium early return, so the hook order stays stable.
  const sortedAscendingScores = useMemo(() => {
    if (!currentVoter) return [];
    return Object.entries(currentVoter.scores)
      .map(([targetId, pts]) => {
        const target = teams.find((t) => t.id === targetId);
        return {
          targetId,
          dishName: target?.dishName || (target ? `Tapa de ${teamLabel(target, members)}` : 'Tapa'),
          teamName: target ? teamLabel(target, members) : 'Equipo',
          photoUrl: target?.photoUrl,
          points: pts,
          isRevealed: gala.revealedTapaIds.includes(targetId)
        };
      })
      .sort((a, b) => a.points - b.points);
  }, [currentVoter, teams, members, gala.revealedTapaIds]);

  const maxPointValue = sortedAscendingScores.length > 0
    ? sortedAscendingScores[sortedAscendingScores.length - 1].points
    : 0;

  // Pending (not yet revealed) scores, ascending. The gala mode decides how many are revealed one by one.
  const pendingScores = sortedAscendingScores.filter((s) => !s.isRevealed);
  const mode: GalaMode = galaMode ?? 'CLASICA';
  const dramaticCount =
    mode === 'CLASICA'
      ? pendingScores.length
      : mode === 'DIRECTA'
      ? 0
      : Math.min(mode === 'MAXIMA' ? 1 : 3, pendingScores.length);
  const bulkCount = pendingScores.length - dramaticCount;
  const nextBulkScores = bulkCount > 0 ? pendingScores.slice(0, bulkCount) : null;
  const nextPointToReveal = !nextBulkScores && pendingScores.length > 0 ? pendingScores[0] : undefined;

  // Points revealed so far, highest first
  const revealedScores = sortedAscendingScores
    .filter((s) => s.isRevealed)
    .sort((a, b) => b.points - a.points);

  const canUndo = (gala.history?.length ?? 0) > 0 || gala.currentVoterIndex > 0;

  // If in PODIO phase, show grand podium
  if (phase === 'PODIO' || gala.currentVoterIndex >= votersList.length) {
    const finalScoreboard = calculateScoreboard(teams, members, votes, voteMode);
    return <PodiumView finalRanking={finalScoreboard} canControl={canControl} onRestart={onRestart} />;
  }

  const bulkSum = nextBulkScores
    ? nextBulkScores.reduce((acc, score) => acc + score.points, 0)
    : 0;

  // What the last click put on screen: a whole batch ("reparto rápido") or a single point
  const batchIds = (gala.lastBatchIds ?? []).filter((id) => gala.revealedTapaIds.includes(id));
  const lastBatch = batchIds.length > 1
    ? revealedScores.filter((s) => batchIds.includes(s.targetId))
    : null;
  const lastSingle = !lastBatch && gala.lastAwardedTapaId
    ? revealedScores.find((s) => s.targetId === gala.lastAwardedTapaId)
    : undefined;
  const isMaxMoment = !!lastSingle && lastSingle.points === maxPointValue;

  const useTwoColumns = scoreboard.length > SINGLE_COLUMN_MAX;
  const boardStyle = {
    '--rows': useTwoColumns ? Math.ceil(scoreboard.length / 2) : scoreboard.length,
    '--cols': useTwoColumns ? 2 : 1
  } as CSSProperties;

  return (
    <div className={styles.gala}>
      <div className={styles.topStrip}>
        <span className={`${tv.pill} ${tv.pillLive}`}>Gala en directo</span>

        <div className={styles.juryCount}>
          Jurado {gala.currentVoterIndex + 1} de {votersList.length}
          <span className={styles.juryDots} aria-hidden="true">
            {votersList.map((jury, index) => (
              <span
                key={jury.id}
                className={`${styles.juryDot} ${
                  index < gala.currentVoterIndex
                    ? styles.juryDotDone
                    : index === gala.currentVoterIndex
                    ? styles.juryDotNow
                    : ''
                }`}
              />
            ))}
          </span>
        </div>
      </div>

      <div className={styles.body}>
        {/* Live scoreboard */}
        <div className={styles.scoreboardCol} style={boardStyle}>
          <ScoreboardList
            items={scoreboard}
            lastAwardedTapaId={gala.lastAwardedTapaId}
            lastAwardedPoints={gala.lastAwardedPoints}
          />
        </div>

        {/* The jury on air */}
        <div className={styles.spotlight}>
          {currentVoter && (
            <div className={styles.juryHeader}>
              <div className={styles.voterAvatar} aria-hidden="true">
                {currentVoter.name.slice(0, 2).toUpperCase()}
              </div>
              <div className={styles.juryText}>
                <span className={tv.kicker}>Reparte sus puntos</span>
                <h2 className={styles.voterNameHeading}>{currentVoter.name}</h2>
                <div className={styles.juryMeta}>
                  {currentVoterTeam?.dishName ? `Su tapa: ${currentVoterTeam.dishName}` : ''}
                  {currentVoter.memberCount > 1 && (
                    <>
                      {' '}· Voto combinado
                      {currentVoter.votedCount < currentVoter.memberCount &&
                        ` (${currentVoter.votedCount} de ${currentVoter.memberCount} han votado)`}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className={`${styles.hero} ${isMaxMoment ? styles.heroMax : ''}`}>
            {isMaxMoment && <Confetti count={48} burstKey={`${gala.currentVoterIndex}-max`} />}

            {lastSingle ? (
              <>
                {isMaxMoment && (
                  <span className={tv.pill}>
                    <CrownIcon />
                    Máxima puntuación
                  </span>
                )}
                <div key={`${gala.currentVoterIndex}-${lastSingle.targetId}`} className={styles.heroPoints}>
                  +{lastSingle.points}
                </div>
                <div key={`t-${gala.currentVoterIndex}-${lastSingle.targetId}`} className={styles.heroTarget}>
                  {lastSingle.photoUrl && <img src={lastSingle.photoUrl} alt="" className={styles.heroPhoto} />}
                  <div style={{ minWidth: 0 }}>
                    <div className={styles.heroDish}>{lastSingle.dishName}</div>
                    <div className={styles.heroTeam}>{lastSingle.teamName}</div>
                  </div>
                </div>
              </>
            ) : lastBatch ? (
              <>
                <div className={styles.heroBatchTitle}>Reparto rápido</div>
                <div className={styles.batchList}>
                  {lastBatch.map((score, index) => (
                    <div key={score.targetId} className={styles.batchRow} style={{ animationDelay: `${index * 70}ms` }}>
                      <strong>+{score.points}</strong>
                      <span>{score.dishName}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className={styles.heroWaiting}>
                  {currentVoter ? `Conectamos con ${currentVoter.name}` : 'Preparando el siguiente jurado'}
                </div>
                <div className={styles.heroWaitingSub}>
                  {sortedAscendingScores.length > 0
                    ? `Reparte de ${maxPointValue} a 1 ${maxPointValue === 1 ? 'punto' : 'puntos'}`
                    : ''}
                </div>
              </>
            )}
          </div>

          <div className={styles.delivered}>
            {revealedScores.length === 0 ? (
              <span className={styles.deliveredEmpty}>Aún no ha entregado ningún punto.</span>
            ) : (
              revealedScores.map((score) => (
                <span key={score.targetId} className={styles.deliveredChip}>
                  <b>{score.points}</b>
                  <span>{score.dishName}</span>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Organizer controls */}
      {canControl && (
        <div className={tv.controlBar}>
          <div className={tv.controlGroup}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onUndoGalaStep}
              disabled={!canUndo}
              title="Deshacer el último paso de la gala"
            >
              <svg className="icon" viewBox="0 0 24 24">
                <polyline points="9 14 4 9 9 4" />
                <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
              </svg>
              Deshacer
            </button>
            <FullscreenButton />
          </div>

          <button className="btn btn-primary" onClick={onNextGalaStep}>
            {nextBulkScores ? (
              <>
                <BoltIcon />
                Reparto rápido (+{bulkSum} {bulkSum === 1 ? 'punto' : 'puntos'})
              </>
            ) : nextPointToReveal ? (
              nextPointToReveal.points === maxPointValue ? (
                <>
                  <CrownIcon />
                  Revelar MÁXIMA PUNTUACIÓN (+{nextPointToReveal.points} pts)
                </>
              ) : (
                <>
                  <svg className="icon" viewBox="0 0 24 24">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Revelar siguiente voto (+{nextPointToReveal.points} {nextPointToReveal.points === 1 ? 'punto' : 'puntos'})
                </>
              )
            ) : (
              <>
                <ArrowRightIcon />
                Conectar con Siguiente Jurado ({gala.currentVoterIndex + 2 <= votersList.length ? `Jurado ${gala.currentVoterIndex + 2}` : 'Ver Podio'})
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
