import { Member, Team } from '../../types/contest';
import { teamLabel } from '../../utils/teams';
import { FullscreenButton } from '../tv/TVShell';
import tv from '../tv/TVStage.module.css';

interface TastingViewProps {
  teams: Team[];
  members: Member[];
  activeId?: string;
  /** False on the public TV screen, so nobody can browse ahead to tapas that have not been served yet. */
  canControl: boolean;
  onSelectActive: (id: string) => void;
  onProceedToVoting: () => void;
}

export function TastingView({
  teams,
  members,
  activeId,
  canControl,
  onSelectActive,
  onProceedToVoting
}: TastingViewProps) {
  const sorted = [...teams].sort((a, b) => a.tastingOrder - b.tastingOrder);
  const currentIndex = sorted.findIndex((t) => t.id === (activeId || sorted[0]?.id));
  const currentTeam = sorted[currentIndex >= 0 ? currentIndex : 0];

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

  if (!currentTeam) {
    return <div style={{ padding: '4cqh 4cqw' }}>No hay tapas registradas para degustación.</div>;
  }

  return (
    <div className={tv.screen}>
      <div className={tv.split}>
        <div className={tv.photoPane}>
          {currentTeam.photoUrl ? (
            <img key={currentTeam.id} src={currentTeam.photoUrl} alt="" className={tv.photoImg} />
          ) : (
            <div className={tv.photoEmpty}>Sin foto</div>
          )}
        </div>

        <div key={currentTeam.id} className={tv.infoPane}>
          <div>
            <span className={`${tv.pill} ${tv.pillLive}`}>En la mesa ahora</span>
          </div>

          <div className={tv.turn}>
            <small>TURNO</small>
            {currentTeam.tastingOrder}
            <small>de {sorted.length}</small>
          </div>

          <div className={tv.infoBody}>
            <div className={tv.teamLine}>{teamLabel(currentTeam, members)}</div>
            <h1 className={tv.bigTitle}>{currentTeam.dishName || `Tapa de ${teamLabel(currentTeam, members)}`}</h1>
            {currentTeam.description && <p className={tv.lead}>{currentTeam.description}</p>}
          </div>

          <div className={tv.spacer} />

          {currentTeam.ingredients.length > 0 && (
            <div>
              <div className={tv.kicker} style={{ marginBottom: '1.2cqh' }}>
                Ingredientes
              </div>
              <div className={tv.chips}>
                {currentTeam.ingredients.map((ing, i) => (
                  <span key={i} className={tv.chip}>
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {canControl && (
        <div className={tv.controlBar}>
          <div className={tv.controlGroup}>
            <button className="btn btn-secondary btn-sm" onClick={handlePrev} disabled={currentIndex === 0}>
              <svg className="icon" viewBox="0 0 24 24">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Tapa Anterior
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleNext}
              disabled={currentIndex === sorted.length - 1}
            >
              Siguiente Tapa
              <svg className="icon" viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <FullscreenButton />
          </div>

          <button className="btn btn-secondary btn-sm" onClick={onProceedToVoting}>
            Abrir Votación
            <svg className="icon" viewBox="0 0 24 24">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
