import { useEffect, useState } from 'react';
import { Member, Team } from '../../types/contest';
import { teamLabel } from '../../utils/teams';
import tastingStyles from '../tasting/TastingView.module.css';
import styles from './VotingTVView.module.css';

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

  return (
    <div className={tastingStyles.tastingWrapper}>
      <div className={tastingStyles.navigationBar} style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
          <span className="badge badge-green">Votación en Curso</span>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Reparte tus puntos desde el móvil (de {Math.max(teams.length - 1, 0)} a 1)
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div style={{ textAlign: 'right' }}>
            <div className={styles.voteCounter}>
              {votedCount} / {totalVoters}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {allVoted ? 'Todos los votos recibidos' : 'votos sellados'}
            </div>
          </div>

          {canControl && (
            <button className="btn btn-primary" onClick={onStartGala} disabled={votedCount === 0}>
              Comenzar la Gran Gala
              <svg className="icon" viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {currentTeam && (
        <div key={currentTeam.id} className={`${tastingStyles.tastingCard} ${styles.slide}`}>
          <div className={tastingStyles.imageContainer}>
            {currentTeam.photoUrl ? (
              <img src={currentTeam.photoUrl} alt={currentTeam.dishName} className={tastingStyles.tapaHeroImage} />
            ) : (
              <div className="flex items-center justify-center" style={{ height: '100%', color: 'var(--text-muted)' }}>
                Sin fotografía
              </div>
            )}
            <div className={tastingStyles.turnFloatingBadge}>TAPA #{currentTeam.tastingOrder}</div>
          </div>

          <div className={tastingStyles.detailsContent}>
            <div>
              <div className={tastingStyles.authorHeadline}>
                Equipo: <strong>{teamLabel(currentTeam, members)}</strong>
              </div>
              <h1 className={tastingStyles.dishHeading}>
                {currentTeam.dishName || `Tapa de ${teamLabel(currentTeam, members)}`}
              </h1>

              {currentTeam.description && (
                <p className={tastingStyles.descriptionParagraph}>{currentTeam.description}</p>
              )}

              {currentTeam.ingredients.length > 0 && (
                <div className={tastingStyles.ingredientsSection}>
                  <div className={tastingStyles.ingredientsTitle}>Ingredientes Clave</div>
                  <div className={tastingStyles.ingredientChips}>
                    {currentTeam.ingredients.map((ing, i) => (
                      <span key={i} className={tastingStyles.ingredientChip}>
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="mono" style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Repaso de tapas · {currentIndex + 1} de {sorted.length}
              </div>
              <div className={styles.progressTrack}>
                {sorted.map((team, i) => (
                  <span
                    key={team.id}
                    className={`${styles.progressDot} ${i === currentIndex ? styles.progressDotActive : ''}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
