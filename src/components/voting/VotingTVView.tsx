import { useEffect, useState } from 'react';
import { Member, Team } from '../../types/contest';
import { teamLabel } from '../../utils/teams';
import { FullscreenButton } from '../tv/TVShell';
import tv from '../tv/TVStage.module.css';

interface VotingTVViewProps {
  teams: Team[];
  members: Member[];
  votedCount: number;
  totalVoters: number;
  /** False on the public TV screen: only the organizer can start the gala. */
  canControl: boolean;
  onStartGala: () => void;
}

const SLIDE_SECONDS = 10;

/**
 * TV screen while the jury votes on their phones: cycles through every tapa in serving order so
 * everybody can remember each dish before sealing their points, with the live vote count on top.
 */
export function VotingTVView({ teams, members, votedCount, totalVoters, canControl, onStartGala }: VotingTVViewProps) {
  const sorted = [...teams].sort((a, b) => a.tastingOrder - b.tastingOrder);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (sorted.length <= 1) return;
    const interval = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % sorted.length);
    }, SLIDE_SECONDS * 1000);
    return () => clearInterval(interval);
  }, [sorted.length]);

  const currentIndex = sorted.length > 0 ? slideIndex % sorted.length : 0;
  const currentTeam = sorted[currentIndex];
  const allVoted = totalVoters > 0 && votedCount >= totalVoters;
  const progress = totalVoters > 0 ? Math.min(100, Math.round((votedCount / totalVoters) * 100)) : 0;

  return (
    <div className={tv.screen}>
      <div className={tv.split}>
        <div className={tv.photoPane}>
          {currentTeam?.photoUrl ? (
            <img key={currentTeam.id} src={currentTeam.photoUrl} alt="" className={tv.photoImg} />
          ) : (
            <div className={tv.photoEmpty}>Sin foto</div>
          )}
          {currentTeam && (
            <div className={tv.photoBadge}>
              <small>TAPA</small>
              {currentTeam.tastingOrder}
            </div>
          )}
        </div>

        <div className={tv.infoPane}>
          <div>
            <span className={`${tv.pill} ${tv.pillLive}`}>Votación en curso</span>
          </div>

          <div className={tv.counterRow}>
            <div className={tv.counter}>
              {votedCount}
              <small>/{totalVoters}</small>
            </div>
            <div className={tv.kicker} style={{ textAlign: 'right' }}>
              {allVoted ? 'Todos han votado' : 'votos sellados'}
              <br />
              De {Math.max(teams.length - 1, 0)} a 1 puntos, desde el móvil
            </div>
          </div>
          <div className={tv.meter}>
            <div className={tv.meterFill} style={{ width: `${progress}%` }} />
          </div>

          {currentTeam && (
            <div key={currentTeam.id} className={tv.infoBody}>
              <div className={tv.teamLine}>{teamLabel(currentTeam, members)}</div>
              <h1 className={tv.bigTitle}>{currentTeam.dishName || `Tapa de ${teamLabel(currentTeam, members)}`}</h1>
              {currentTeam.description && <p className={tv.lead}>{currentTeam.description}</p>}
              {currentTeam.ingredients.length > 0 && (
                <div className={tv.chips}>
                  {currentTeam.ingredients.slice(0, 6).map((ing, i) => (
                    <span key={i} className={tv.chip}>
                      {ing}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={tv.spacer} />

          <div className={tv.thumbs} aria-hidden="true">
            {sorted.map((team, i) => (
              <div key={team.id} className={`${tv.thumb} ${i === currentIndex ? tv.thumbActive : ''}`}>
                {team.photoUrl && <img src={team.photoUrl} alt="" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {canControl && (
        <div className={tv.controlBar}>
          <div className={tv.controlGroup}>
            <FullscreenButton />
            <span className={tv.controlHint}>
              Al empezar la gala se cierra la votación: quien no haya sellado su voto se queda fuera.
            </span>
          </div>
          <button className="btn btn-primary" onClick={onStartGala} disabled={votedCount === 0}>
            Comenzar la Gran Gala
            <svg className="icon" viewBox="0 0 24 24">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
