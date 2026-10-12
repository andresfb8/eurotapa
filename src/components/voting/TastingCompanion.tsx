import { Member, Team } from '../../types/contest';
import { teamLabel } from '../../utils/teams';
import { CheckIcon, PlusIcon } from '../Icons';
import { RankingBallot } from './RankingBallot';
import styles from './VotingView.module.css';

interface TastingCompanionProps {
  teams: Team[];
  members: Member[];
  currentTeam: Team;
  /** Team whose tapa is on the TV right now. */
  activeTastingId?: string;
  /** Highest turn served so far, so tapas do not vanish if the TV steps back to an earlier one. */
  servedUpTo?: number;
  ranking: string[];
  onRankingChange: (ranking: string[]) => void;
  notes: Record<string, string>;
  onNoteChange: (teamId: string, note: string) => void;
}

/**
 * The phone during the tasting: the tapa on the table, a private note for it and a provisional
 * ranking that grows tapa by tapa, so voting later is confirming an order instead of recalling
 * eight dishes from memory. Tapas that have not been served yet stay hidden.
 */
export function TastingCompanion({
  teams,
  members,
  currentTeam,
  activeTastingId,
  servedUpTo,
  ranking,
  onRankingChange,
  notes,
  onNoteChange
}: TastingCompanionProps) {
  const sorted = [...teams].sort((a, b) => a.tastingOrder - b.tastingOrder);
  const active = sorted.find((t) => t.id === activeTastingId) ?? sorted[0];
  const activeOrder = active?.tastingOrder ?? 0;

  if (!active) return null;

  const servedOrder = Math.max(servedUpTo ?? 0, activeOrder);
  const servedRivals = sorted.filter((t) => t.id !== currentTeam.id && t.tastingOrder <= servedOrder);
  const isOwnTapa = active.id === currentTeam.id;
  const isActiveRanked = ranking.includes(active.id);
  const servedRanking = ranking.filter((id) => servedRivals.some((t) => t.id === id));

  return (
    <>
      {/* The tapa on the table */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="flex items-center justify-between" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <span className="badge badge-blue">En la mesa ahora</span>
          <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Tapa {active.tastingOrder} de {sorted.length}
          </span>
        </div>

        {active.photoUrl && <img src={active.photoUrl} alt="" className={styles.tastingPhoto} />}

        <div>
          <div className={styles.authorText}>Equipo: {teamLabel(active, members)}</div>
          <h2 style={{ fontSize: '1.6rem', marginTop: '2px' }}>
            {active.dishName || `Tapa de ${teamLabel(active, members)}`}
          </h2>
          {active.description && (
            <p style={{ fontSize: '14px', color: 'var(--text-body)', marginTop: '6px' }}>{active.description}</p>
          )}
          {active.ingredients.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
              {active.ingredients.map((ing, i) => (
                <span key={i} className="badge badge-neutral" style={{ fontSize: '11px', textTransform: 'none' }}>
                  {ing}
                </span>
              ))}
            </div>
          )}
        </div>

        {isOwnTapa ? (
          <div className={styles.companionNote}>
            Es {members.filter((m) => m.teamId === currentTeam.id).length > 1 ? 'vuestra' : 'tu'} tapa: a servir y a
            disfrutar. No entra en tu ranking porque no puedes votarla.
          </div>
        ) : (
          <>
            <label className={styles.noteField}>
              <span>Mi nota (solo la ves tú)</span>
              <textarea
                rows={2}
                value={notes[active.id] ?? ''}
                onChange={(e) => onNoteChange(active.id, e.target.value)}
                placeholder="Qué te ha parecido, qué recordarás al votar..."
              />
            </label>

            {isActiveRanked ? (
              <div className={styles.companionNote}>
                <CheckIcon /> Ya está en tu ranking, en el puesto {servedRanking.indexOf(active.id) + 1}º. Muévela abajo
                si cambias de opinión.
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '12px' }}
                onClick={() => onRankingChange([...ranking, active.id])}
              >
                <PlusIcon />
                Añadir a mi ranking
              </button>
            )}
          </>
        )}
      </div>

      {/* Provisional ranking with the tapas served so far */}
      {servedRivals.length > 0 && (
        <>
          <RankingBallot
            rivals={servedRivals}
            members={members}
            ranking={servedRanking}
            onChange={onRankingChange}
            positionsOnly
            notes={notes}
            onNoteChange={onNoteChange}
          />
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Tu ranking y tus notas se guardan solo en este móvil. Cuando se abra la votación lo tendrás ya ordenado y
            podrás retocarlo antes de sellar.
          </p>
        </>
      )}
    </>
  );
}
