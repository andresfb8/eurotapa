import { useMemo, useState } from 'react';
import { GalaMode, GalaState, Member, Team, VoteRecord, ContestPhase } from '../../types/contest';
import { calculateScoreboard } from '../../utils/scoring';
import { teamLabel } from '../../utils/teams';
import { ScoreboardList } from './ScoreboardList';
import { PodiumView } from './PodiumView';
import styles from './GalaTVView.module.css';

interface GalaTVViewProps {
  teams: Team[];
  members: Member[];
  votes: Record<string, VoteRecord>;
  gala: GalaState;
  phase: ContestPhase;
  galaMode?: GalaMode;
  onNextGalaStep: () => void;
  onUndoGalaStep: () => void;
  onRestart: () => void;
}

export function GalaTVView({
  teams,
  members,
  votes,
  gala,
  phase,
  galaMode,
  onNextGalaStep,
  onUndoGalaStep,
  onRestart
}: GalaTVViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Voters list: members who have registered votes
  const votersList = useMemo(
    () => members.filter((m) => !!votes[m.id]),
    [members, votes]
  );

  const currentVoter = votersList[gala.currentVoterIndex];
  const currentVoteRecord = currentVoter ? votes[currentVoter.id] : undefined;
  const currentVoterTeam = currentVoter
    ? teams.find((team) => team.id === currentVoter.teamId)
    : undefined;

  // Real-time animated scoreboard based on current reveal progress
  const scoreboard = useMemo(() => {
    return calculateScoreboard(teams, members, votes, {
      currentVoterIndex: gala.currentVoterIndex,
      activeVotersList: votersList,
      galaState: gala
    });
  }, [teams, members, votes, gala, votersList]);

  // Sorted list of votes from current voter in ASCENDING order (1 pt, 2 pts, ..., max pts).
  // This hook must run on every render, before the podium early return, so the hook order stays stable.
  const sortedAscendingScores = useMemo(() => {
    if (!currentVoteRecord) return [];
    return Object.entries(currentVoteRecord.scores)
      .map(([targetId, pts]) => {
        const target = teams.find((t) => t.id === targetId);
        return {
          targetId,
          dishName: target?.dishName || 'Tapa',
          teamName: target ? teamLabel(target, members) : 'Equipo',
          points: pts,
          isRevealed: gala.revealedTapaIds.includes(targetId)
        };
      })
      .sort((a, b) => a.points - b.points);
  }, [currentVoteRecord, teams, members, gala.revealedTapaIds]);

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

  // List of points revealed so far, sorted descending for display
  const revealedScores = sortedAscendingScores
    .filter((s) => s.isRevealed)
    .sort((a, b) => b.points - a.points);

  // Summary of the last bulk reveal ("reparto rápido")
  const batchSummary = useMemo(() => {
    const batchIds = gala.lastBatchIds ?? [];
    if (batchIds.length === 0 || !currentVoteRecord) return null;
    const sum = batchIds.reduce((acc, id) => acc + (currentVoteRecord.scores[id] ?? 0), 0);
    return { count: batchIds.length, sum };
  }, [gala.lastBatchIds, currentVoteRecord]);

  const canUndo = (gala.history?.length ?? 0) > 0 || gala.currentVoterIndex > 0;

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
    const finalScoreboard = calculateScoreboard(teams, members, votes);
    return <PodiumView finalRanking={finalScoreboard} onRestart={onRestart} />;
  }

  const bulkSum = nextBulkScores
    ? nextBulkScores.reduce((acc, score) => acc + score.points, 0)
    : 0;

  return (
    <div className={styles.galaContainer}>
      {/* Top Banner */}
      <div className={styles.galaHeader}>
        <div className="flex items-center gap-3">
          <span className="badge badge-yellow">Modo TV — Gala Eurovisión</span>
          <span className="mono" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Jurado {gala.currentVoterIndex + 1} de {votersList.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Undo last reveal */}
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

          {/* Fullscreen toggle */}
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

          {/* Action button */}
          <button
            className="btn btn-primary"
            onClick={onNextGalaStep}
            style={{ padding: '10px 22px', fontSize: '15px' }}
          >
            {nextBulkScores ? (
              <>
                <span style={{ fontSize: '16px' }}>⚡</span>
                Reparto rápido (+{bulkSum} {bulkSum === 1 ? 'punto' : 'puntos'})
              </>
            ) : nextPointToReveal ? (
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
        {/* Left Column: Live Scoreboard */}
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
                    {currentVoterTeam ? (
                      <>
                        Su tapa: <em>{currentVoterTeam.dishName || 'Sin título'}</em>
                        {members.filter((m) => m.teamId === currentVoterTeam.id).length > 1 && (
                          <> · Equipo: {teamLabel(currentVoterTeam, members)}</>
                        )}
                      </>
                    ) : null}
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
                <span>Puntos Revelados</span>
                <span>{revealedScores.length} de {sortedAscendingScores.length}</span>
              </div>

              {batchSummary && (
                <div
                  className="badge badge-blue"
                  style={{ marginBottom: '10px', padding: '6px 10px', fontSize: '12px', textTransform: 'none' }}
                >
                  ⚡ Reparto rápido: {batchSummary.count} tapas · +{batchSummary.sum} puntos
                </div>
              )}

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
                  Pulsa el botón superior para desvelar {mode === 'DIRECTA' ? 'el voto completo' : 'el primer voto (+1 punto)'} de {currentVoter?.name}...
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
                            Equipo: {score.teamName}
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
