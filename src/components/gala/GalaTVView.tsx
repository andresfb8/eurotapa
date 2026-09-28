import { useMemo, useState } from 'react';
import { Participant, VoteRecord, GalaState, ContestPhase } from '../../types/contest';
import { calculateScoreboard } from '../../utils/scoring';
import { ScoreboardList } from './ScoreboardList';
import { PodiumView } from './PodiumView';
import styles from './GalaTVView.module.css';

interface GalaTVViewProps {
  participants: Participant[];
  votes: Record<string, VoteRecord>;
  gala: GalaState;
  phase: ContestPhase;
  onNextGalaStep: () => void;
  onRestart: () => void;
}

export function GalaTVView({
  participants,
  votes,
  gala,
  phase,
  onNextGalaStep,
  onRestart
}: GalaTVViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Voters list: participants who have registered votes
  const votersList = useMemo(
    () => participants.filter((p) => !!votes[p.id]),
    [participants, votes]
  );

  const currentVoter = votersList[gala.currentVoterIndex];
  const currentVoteRecord = currentVoter ? votes[currentVoter.id] : undefined;

  // Real-time animated scoreboard based on current reveal progress
  const scoreboard = useMemo(() => {
    return calculateScoreboard(participants, votes, {
      currentVoterIndex: gala.currentVoterIndex,
      activeVotersList: votersList,
      galaState: gala
    });
  }, [participants, votes, gala, votersList]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // If in PODIO phase, show grand podium
  if (phase === 'PODIO' || gala.currentVoterIndex >= votersList.length) {
    const finalScoreboard = calculateScoreboard(participants, votes);
    return <PodiumView finalRanking={finalScoreboard} onRestart={onRestart} />;
  }

  // Sorted list of votes from current voter in ASCENDING order (1 pt, 2 pts, ..., max pts)
  const sortedAscendingScores = useMemo(() => {
    if (!currentVoteRecord) return [];
    return Object.entries(currentVoteRecord.scores)
      .map(([targetId, pts]) => {
        const target = participants.find((p) => p.id === targetId);
        return {
          targetId,
          dishName: target?.dishName || 'Tapa',
          chefName: target?.name || 'Chef',
          points: pts,
          isRevealed: gala.revealedTapaIds.includes(targetId)
        };
      })
      .sort((a, b) => a.points - b.points);
  }, [currentVoteRecord, participants, gala.revealedTapaIds]);

  const maxPointValue = sortedAscendingScores.length > 0
    ? sortedAscendingScores[sortedAscendingScores.length - 1].points
    : 0;

  // Find the exact next point that will be revealed on click
  const nextPointToReveal = sortedAscendingScores.find((s) => !s.isRevealed);

  // List of points revealed so far, sorted descending for display
  const revealedScores = sortedAscendingScores
    .filter((s) => s.isRevealed)
    .sort((a, b) => b.points - a.points);

  return (
    <div className={styles.galaContainer}>
      {/* Top Banner */}
      <div className={styles.galaHeader}>
        <div className="flex items-center gap-3">
          <span className="badge badge-yellow">Modo TV — Gala Eurovisión (Monitor 27")</span>
          <span className="mono" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Jurado {gala.currentVoterIndex + 1} de {votersList.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Fullscreen toggle for the 27" monitor */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={toggleFullscreen}
            title="Poner en pantalla completa"
          >
            <svg className="icon" viewBox="0 0 24 24">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            {isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
          </button>

          {/* Action button: Reveals strictly 1 by 1 */}
          <button
            className="btn btn-primary"
            onClick={onNextGalaStep}
            style={{ padding: '10px 22px', fontSize: '15px' }}
          >
            {nextPointToReveal ? (
              nextPointToReveal.points === maxPointValue ? (
                <>
                  <span style={{ fontSize: '16px' }}>👑</span>
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
                <span>➔</span>
                Conectar con Siguiente Jurado ({gala.currentVoterIndex + 2 <= votersList.length ? `Jurado ${gala.currentVoterIndex + 2}` : 'Ver Podio'})
              </>
            )}
          </button>
        </div>
      </div>

      <div className={styles.galaGrid}>
        {/* Left Column: Live Scoreboard without bars, highly legible for 27" monitor */}
        <div className={styles.scoreboardCol}>
          <div className={styles.scoreboardHeader}>
            <span>Posición y Tapa</span>
            <span>Puntos Totales</span>
          </div>

          <ScoreboardList
            items={scoreboard}
            lastAwardedTapaId={gala.lastAwardedTapaId}
            lastAwardedPoints={gala.lastAwardedPoints}
          />
        </div>

        {/* Right Column: Live Voter Spotlight on TV broadcast */}
        <div className={styles.spotlightCol}>
          <div className={styles.spotlightCard}>
            <div className="badge badge-neutral" style={{ alignSelf: 'flex-start' }}>
              En Conexión Directa
            </div>

            {currentVoter && (
              <div className={styles.voterMetaArea}>
                <div className={styles.voterAvatar}>
                  {currentVoter.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className={styles.voterNameHeading}>{currentVoter.name}</h2>
                  <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Tapa propia: <em>{currentVoter.dishName}</em>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div
                style={{
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-subtle)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
              >
                <span>Puntos Revelados Uno a Uno</span>
                <span>{revealedScores.length} de {sortedAscendingScores.length}</span>
              </div>

              {revealedScores.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '36px 20px',
                    color: 'var(--text-muted)',
                    fontSize: '15px',
                    border: '1px dashed var(--border-color)',
                    borderRadius: '6px'
                  }}
                >
                  Pulsa el botón superior para desvelar el primer voto (+1 punto) de {currentVoter?.name}...
                </div>
              ) : (
                <div className={styles.revealedPointsList}>
                  {revealedScores.map((score) => {
                    const isMax = score.points === maxPointValue;
                    const isLatest = gala.lastAwardedTapaId === score.targetId;

                    return (
                      <div
                        key={score.targetId}
                        className={`${styles.pointRow} ${
                          isMax ? styles.pointRowMax : isLatest ? styles.pointRowTop3 : ''
                        }`}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '15px' }}>
                            {score.dishName}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Chef: {score.chefName}
                          </div>
                        </div>

                        <span className={styles.pointsPill}>
                          +{score.points} pts
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
