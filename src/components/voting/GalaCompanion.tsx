import { useMemo, useState } from 'react';
import { ContestPhase, GalaState, Member, Team, VoteRecord } from '../../types/contest';
import { buildJuryVotes } from '../../utils/juries';
import { calculateScoreboard } from '../../utils/scoring';
import { membersOfTeam, teamLabel } from '../../utils/teams';
import { CheckIcon, CrownIcon } from '../Icons';
import styles from './VotingView.module.css';

interface GalaCompanionProps {
  title: string;
  teams: Team[];
  members: Member[];
  votes: Record<string, VoteRecord>;
  gala: GalaState;
  phase: ContestPhase;
  currentTeam: Team;
}

const pts = (n: number) => `${n} ${n === 1 ? 'punto' : 'puntos'}`;

/**
 * Second screen for the phone while the gala runs on the TV: how your own tapa is doing, live.
 * It only ever shows points that have already been revealed on the TV, and turns into a personal
 * summary once the podium is out.
 */
export function GalaCompanion({ title, teams, members, votes, gala, phase, currentTeam }: GalaCompanionProps) {
  const [isCopied, setIsCopied] = useState(false);

  const juries = useMemo(() => buildJuryVotes(teams, members, votes), [teams, members, votes]);
  const isFinal = phase === 'PODIO' || gala.currentVoterIndex >= juries.length;

  const scoreboard = useMemo(
    () =>
      isFinal
        ? calculateScoreboard(teams, members, votes)
        : calculateScoreboard(teams, members, votes, { currentVoterIndex: gala.currentVoterIndex, galaState: gala }),
    [teams, members, votes, gala, isFinal]
  );

  const isTeam = membersOfTeam(currentTeam.id, members).length > 1;
  const mine = scoreboard.find((item) => item.teamId === currentTeam.id);
  const mineIndex = scoreboard.findIndex((item) => item.teamId === currentTeam.id);
  const above = mineIndex > 0 ? scoreboard[mineIndex - 1] : undefined;

  const currentJury = isFinal ? undefined : juries[gala.currentVoterIndex];
  const isMyJuryOnAir = currentJury?.teamId === currentTeam.id;

  // Points each rival jury has given to this tapa, limited to what the TV has already shown
  const received = juries
    .map((jury, index) => ({ jury, index }))
    .filter(({ jury }) => jury.teamId !== currentTeam.id && jury.scores[currentTeam.id] !== undefined)
    .filter(
      ({ index }) =>
        isFinal ||
        index < gala.currentVoterIndex ||
        (index === gala.currentVoterIndex && gala.revealedTapaIds.includes(currentTeam.id))
    )
    .map(({ jury }) => ({ name: jury.name, points: jury.scores[currentTeam.id] }));

  const pendingJuries = isFinal
    ? 0
    : juries.filter(
        (jury, index) =>
          jury.teamId !== currentTeam.id &&
          (index > gala.currentVoterIndex ||
            (index === gala.currentVoterIndex && !gala.revealedTapaIds.includes(currentTeam.id)))
      ).length;

  // The reveal that has just happened on the TV, when it was for this tapa
  const justAwarded =
    currentJury &&
    !isMyJuryOnAir &&
    (gala.lastAwardedTapaId === currentTeam.id || (gala.lastBatchIds ?? []).includes(currentTeam.id)) &&
    gala.revealedTapaIds.includes(currentTeam.id)
      ? currentJury.scores[currentTeam.id]
      : undefined;

  const myJury = juries.find((jury) => jury.teamId === currentTeam.id);
  const myJuryRevealed = myJury
    ? Object.entries(myJury.scores)
        .filter(([teamId]) => isFinal || !isMyJuryOnAir || gala.revealedTapaIds.includes(teamId))
        .sort((a, b) => b[1] - a[1])
        .map(([teamId, points]) => {
          const team = teams.find((t) => t.id === teamId);
          return { teamId, points, dishName: team?.dishName || (team ? `Tapa de ${teamLabel(team, members)}` : 'Tapa') };
        })
    : [];

  if (!mine) return null;

  const standings = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {scoreboard.map((item) => {
        const isOwn = item.teamId === currentTeam.id;
        return (
          <div key={item.teamId} className={`${styles.companionRow} ${isOwn ? styles.companionRowOwn : ''}`}>
            <span className="mono" style={{ width: '28px', flexShrink: 0 }}>{item.rank}º</span>
            <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
              {item.dishName || `Tapa de ${item.name}`}
            </span>
            <span className="mono" style={{ flexShrink: 0, fontWeight: 700 }}>{item.totalPoints}</span>
          </div>
        );
      })}
    </div>
  );

  const receivedList = (sorted: boolean) => {
    const rows = sorted ? [...received].sort((a, b) => b.points - a.points) : [...received].reverse();
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {rows.map((row) => (
          <div key={row.name} className={styles.companionRow}>
            <span style={{ flex: 1, minWidth: 0 }}>{row.name}</span>
            <span className="mono" style={{ flexShrink: 0, fontWeight: 700 }}>+{row.points}</span>
          </div>
        ))}
      </div>
    );
  };

  // ---------- Podium: personal summary ----------
  if (isFinal) {
    const best = received.length > 0 ? Math.max(...received.map((r) => r.points)) : 0;
    const fans = received.filter((r) => r.points === best).map((r) => r.name);
    const isChampion = mine.rank === 1;

    const handleShare = async () => {
      let msg = `*${title.toUpperCase()}*\n`;
      msg += `"${mine.dishName}" (${mine.name}) ha quedado en el puesto ${mine.rank} de ${scoreboard.length} con ${pts(mine.totalPoints)}.\n`;
      if (fans.length > 0) msg += `Quien más la puntuó: ${fans.join(', ')} (${pts(best)}).\n`;
      msg += `\n*Clasificación:*\n`;
      scoreboard.forEach((item) => {
        msg += `${item.rank}º ${item.dishName} — ${item.totalPoints} pts\n`;
      });
      try {
        await navigator.clipboard.writeText(msg);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000);
      } catch {
        // Clipboard blocked: nothing to share
      }
    };

    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <span className={`badge ${isChampion ? 'badge-yellow' : 'badge-neutral'}`}>
            {isChampion && <CrownIcon />}
            {isChampion ? 'Campeón EuroTapa' : 'Resultado final'}
          </span>
          <div className={styles.companionRank}>{mine.rank}º</div>
          <h2 style={{ fontSize: '1.5rem' }}>{mine.dishName}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            de {scoreboard.length} tapas · <strong>{pts(mine.totalPoints)}</strong>
          </p>
        </div>

        {fans.length > 0 && (
          <div className={styles.companionNote}>
            <strong>{isTeam ? 'Vuestro mayor fan' : 'Tu mayor fan'}:</strong> {fans.join(', ')}, con {pts(best)}.
          </div>
        )}

        {received.length > 0 && (
          <div>
            <div className={styles.rankSectionTitle} style={{ marginBottom: '6px' }}>
              Puntos que {isTeam ? 'os dieron' : 'te dieron'}
            </div>
            {receivedList(true)}
          </div>
        )}

        {myJuryRevealed.length > 0 && (
          <div>
            <div className={styles.rankSectionTitle} style={{ marginBottom: '6px' }}>
              {isTeam ? 'El voto de vuestro equipo' : 'Tu voto'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {myJuryRevealed.map((row) => (
                <div key={row.teamId} className={styles.companionRow}>
                  <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{row.dishName}</span>
                  <span className="mono" style={{ flexShrink: 0, fontWeight: 700 }}>{row.points}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className={styles.rankSectionTitle} style={{ marginBottom: '6px' }}>Clasificación final</div>
          {standings}
        </div>

        <button type="button" className="btn btn-primary" style={{ padding: '12px' }} onClick={handleShare}>
          {isCopied && <CheckIcon />}
          {isCopied ? 'Copiado, pégalo en WhatsApp' : 'Copiar mi resultado para WhatsApp'}
        </button>
      </div>
    );
  }

  // ---------- Gala in progress ----------
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="flex items-center justify-between" style={{ gap: '8px', flexWrap: 'wrap' }}>
        <span className="badge badge-yellow">Gala en directo</span>
        <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Jurado {Math.min(gala.currentVoterIndex + 1, juries.length)} de {juries.length}
          {currentJury ? ` · ${currentJury.name}` : ''}
        </span>
      </div>

      {isMyJuryOnAir && (
        <div className={`${styles.companionNote} ${styles.companionNoteLive}`}>
          <strong>{isTeam ? 'Vuestro voto está en directo.' : 'Tu voto está en directo.'}</strong>{' '}
          {myJuryRevealed.length === 0
            ? 'Atentos a la pantalla.'
            : `Ya se han revelado ${myJuryRevealed.length} de ${Object.keys(myJury?.scores ?? {}).length}.`}
        </div>
      )}

      {justAwarded !== undefined && currentJury && (
        <div key={`${gala.currentVoterIndex}-${justAwarded}`} className={`${styles.companionNote} ${styles.companionNoteAward}`}>
          <strong>+{justAwarded}</strong> {currentJury.name} {isTeam ? 'os acaba de dar' : 'te acaba de dar'} {pts(justAwarded)}.
        </div>
      )}

      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{mine.dishName || (isTeam ? 'Vuestra tapa' : 'Tu tapa')}</div>
        {mine.totalPoints > 0 && <div className={styles.companionRank}>{mine.rank}º</div>}
        <div style={{ fontSize: '15px' }}>
          <strong>{pts(mine.totalPoints)}</strong>
          {mine.totalPoints > 0 && above && above.totalPoints > mine.totalPoints && (
            <span style={{ color: 'var(--text-muted)' }}>
              {' '}· a {above.totalPoints - mine.totalPoints} del {above.rank}º
            </span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {pendingJuries === 0
            ? 'Ya han votado todos los jurados que podían puntuarla.'
            : `Faltan ${pendingJuries} ${pendingJuries === 1 ? 'jurado' : 'jurados'} por puntuarla.`}
        </div>
      </div>

      {isMyJuryOnAir && myJuryRevealed.length > 0 && (
        <div>
          <div className={styles.rankSectionTitle} style={{ marginBottom: '6px' }}>
            {isTeam ? 'Vuestros puntos revelados' : 'Tus puntos revelados'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {myJuryRevealed.map((row) => (
              <div key={row.teamId} className={styles.companionRow}>
                <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{row.dishName}</span>
                <span className="mono" style={{ flexShrink: 0, fontWeight: 700 }}>{row.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {received.length > 0 && (
        <div>
          <div className={styles.rankSectionTitle} style={{ marginBottom: '6px' }}>
            Puntos recibidos hasta ahora
          </div>
          {receivedList(false)}
        </div>
      )}

      <div>
        <div className={styles.rankSectionTitle} style={{ marginBottom: '6px' }}>Clasificación en directo</div>
        {standings}
      </div>
    </div>
  );
}
