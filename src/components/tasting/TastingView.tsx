import { Participant } from '../../types/contest';
import styles from './TastingView.module.css';

interface TastingViewProps {
  participants: Participant[];
  activeId?: string;
  onSelectActive: (id: string) => void;
  onProceedToVoting: () => void;
}

export function TastingView({
  participants,
  activeId,
  onSelectActive,
  onProceedToVoting
}: TastingViewProps) {
  const sorted = [...participants].sort((a, b) => a.tastingOrder - b.tastingOrder);
  const currentIndex = sorted.findIndex((p) => p.id === (activeId || sorted[0]?.id));
  const currentParticipant = sorted[currentIndex >= 0 ? currentIndex : 0];

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectActive(sorted[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < sorted.length - 1) {
      onSelectActive(sorted[currentIndex + 1].id);
    }
  };

  if (!currentParticipant) {
    return <div>No hay tapas registradas para degustación.</div>;
  }

  return (
    <div className={styles.tastingWrapper}>
      <div className={styles.navigationBar}>
        <div className="flex items-center gap-3">
          <span className="badge badge-blue">Fase 2: Degustación en Vivo</span>
          <span className="mono" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Tapa {currentIndex + 1} de {sorted.length}
          </span>
        </div>

        <button className="btn btn-primary btn-sm" onClick={onProceedToVoting}>
          Abrir Votación
          <svg className="icon" viewBox="0 0 24 24">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div className={styles.tastingCard}>
        <div className={styles.imageContainer}>
          {currentParticipant.photoUrl ? (
            <img
              src={currentParticipant.photoUrl}
              alt={currentParticipant.dishName}
              className={styles.tapaHeroImage}
            />
          ) : (
            <div className="flex items-center justify-center" style={{ height: '100%', color: 'var(--text-muted)' }}>
              Sin fotografía
            </div>
          )}
          <div className={styles.turnFloatingBadge}>
            TURNO #{currentParticipant.tastingOrder}
          </div>
        </div>

        <div className={styles.detailsContent}>
          <div>
            <div className={styles.authorHeadline}>
              Chef Participante: <strong>{currentParticipant.name}</strong>
            </div>
            <h1 className={styles.dishHeading}>{currentParticipant.dishName}</h1>

            <p className={styles.descriptionParagraph}>
              {currentParticipant.description || 'Sin descripción detallada por el chef.'}
            </p>

            {currentParticipant.ingredients.length > 0 && (
              <div className={styles.ingredientsSection}>
                <div className={styles.ingredientsTitle}>Ingredientes Clave</div>
                <div className={styles.ingredientChips}>
                  {currentParticipant.ingredients.map((ing, i) => (
                    <span key={i} className={styles.ingredientChip}>
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={styles.footerControls}>
            <button
              className="btn btn-secondary"
              onClick={handlePrev}
              disabled={currentIndex === 0}
            >
              <svg className="icon" viewBox="0 0 24 24">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Tapa Anterior
            </button>

            <span className="mono" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              #{currentParticipant.tastingOrder} / {sorted.length}
            </span>

            <button
              className="btn btn-secondary"
              onClick={handleNext}
              disabled={currentIndex === sorted.length - 1}
            >
              Siguiente Tapa
              <svg className="icon" viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
