import { Fragment, useRef, useState } from 'react';
import { Member, Team } from '../../types/contest';
import { teamLabel } from '../../utils/teams';
import { PlusIcon } from '../Icons';
import styles from './VotingView.module.css';

interface DragState {
  id: string;
  startPageY: number;
  dy: number;
  /** Page position of every ranked row when the drag started. */
  rows: { top: number; height: number }[];
}

const EDGE_SCROLL_ZONE = 70;
const EDGE_SCROLL_STEP = 14;

interface RankingBallotProps {
  rivals: Team[];
  members: Member[];
  /** Rival team ids from favourite to least favourite; the first one gets the maximum points. */
  ranking: string[];
  onChange: (ranking: string[]) => void;
  /**
   * Tasting mode: not every tapa has been served yet, so rows show their place (1º, 2º...)
   * instead of points, which would still change as more tapas arrive.
   */
  positionsOnly?: boolean;
  /** Private notes of this person, by team id. They never leave the phone. */
  notes?: Record<string, string>;
  onNoteChange?: (teamId: string, note: string) => void;
}

/**
 * The vote is a ranking: tap the tapas from favourite to least favourite to add them, then drag
 * (or use the arrows) to fine-tune. The position decides the points, from N-1 down to 1.
 */
export function RankingBallot({
  rivals,
  members,
  ranking,
  onChange,
  positionsOnly = false,
  notes,
  onNoteChange
}: RankingBallotProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const maxPoints = rivals.length;
  const byId = new Map(rivals.map((r) => [r.id, r]));
  const ranked = ranking.flatMap((id) => (byId.has(id) ? [byId.get(id) as Team] : []));
  const unranked = [...rivals]
    .filter((r) => !ranking.includes(r.id))
    .sort((a, b) => a.tastingOrder - b.tastingOrder);

  // Points the next tapped tapa would get
  const nextPoints = maxPoints - ranked.length;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ranking.length || from === to) return;
    const next = [...ranking];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  // While dragging, rows keep their place in the DOM (moving the node would drop the pointer
  // capture) and are shifted with transforms; the new order is applied when the finger lifts.
  const dragFrom = drag ? ranking.indexOf(drag.id) : -1;
  let dragTarget = dragFrom;
  let dragStep = 0;
  if (drag && dragFrom !== -1) {
    const own = drag.rows[dragFrom];
    const center = own.top + own.height / 2 + drag.dy;
    dragTarget = drag.rows.filter((row, i) => i !== dragFrom && row.top + row.height / 2 < center).length;
    const gap = drag.rows.length > 1 ? drag.rows[1].top - (drag.rows[0].top + drag.rows[0].height) : 0;
    dragStep = own.height + gap;
  }

  /** Where the row at `index` would end up if the finger lifted now. */
  const previewIndex = (index: number) => {
    if (dragFrom === -1) return index;
    if (index === dragFrom) return dragTarget;
    if (dragFrom < index && index <= dragTarget) return index - 1;
    if (dragTarget <= index && index < dragFrom) return index + 1;
    return index;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rows = ranking.map((rowId) => {
      const rect = rowRefs.current.get(rowId)?.getBoundingClientRect();
      return { top: (rect?.top ?? 0) + window.scrollY, height: rect?.height ?? 0 };
    });
    setDrag({ id, startPageY: e.pageY, dy: 0, rows });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    // Long rankings do not fit on a phone: scroll when the finger nears the top or bottom edge
    if (e.clientY < EDGE_SCROLL_ZONE) window.scrollBy(0, -EDGE_SCROLL_STEP);
    else if (e.clientY > window.innerHeight - EDGE_SCROLL_ZONE) window.scrollBy(0, EDGE_SCROLL_STEP);
    setDrag({ ...drag, dy: e.clientY + window.scrollY - drag.startPageY });
  };

  const handlePointerEnd = (commit: boolean) => {
    if (commit && dragFrom !== -1 && dragTarget !== dragFrom) {
      buzz();
      move(dragFrom, dragTarget);
    }
    setDrag(null);
  };

  const buzz = () => {
    try {
      navigator.vibrate?.(12);
    } catch {
      // Vibration is a nicety, never required
    }
  };

  const add = (teamId: string) => {
    buzz();
    setExpandedId(null);
    onChange([...ranking, teamId]);
  };

  const remove = (teamId: string) => {
    setExpandedId(null);
    onChange(ranking.filter((id) => id !== teamId));
  };

  const renderFicha = (team: Team, action: React.ReactNode) => (
    <div className={styles.accordionContent}>
      {team.description && <p style={{ marginBottom: team.ingredients.length > 0 ? '8px' : 0 }}>{team.description}</p>}
      {team.ingredients.length > 0 && (
        <div>
          <strong>Ingredientes:</strong> {team.ingredients.join(', ')}
        </div>
      )}
      {!team.description && team.ingredients.length === 0 && 'Este equipo no ha añadido más detalles.'}
      {onNoteChange && (
        <label className={styles.noteField}>
          <span>Mi nota (solo la ves tú)</span>
          <textarea
            rows={2}
            value={notes?.[team.id] ?? ''}
            onChange={(e) => onNoteChange(team.id, e.target.value)}
            placeholder="Qué te ha parecido, qué recordarás al votar..."
          />
        </label>
      )}
      <div className={styles.fichaActions}>{action}</div>
    </div>
  );

  const renderNotePreview = (team: Team) =>
    notes?.[team.id]?.trim() ? <span className={styles.notePreview}>{notes[team.id]}</span> : null;

  const dishName = (team: Team) => team.dishName || `Tapa de ${teamLabel(team, members)}`;

  return (
    <>
      {/* Ranked tapas */}
      <div className={styles.rankSection}>
        <div className={styles.rankSectionTitle}>
          {positionsOnly ? 'Tu ranking provisional' : 'Tu ranking'} · {ranked.length} de {maxPoints}
        </div>

        {ranked.length === 0 ? (
          <div className={styles.rankEmpty}>
            {positionsOnly ? (
              'Añade aquí cada tapa cuando la pruebes y colócala donde creas que va. Podrás cambiarlo hasta sellar tu voto.'
            ) : (
              <>
                Toca abajo tu tapa favorita para darle los <strong>{maxPoints} puntos</strong>, luego la segunda, y así
                hasta la última.
              </>
            )}
          </div>
        ) : (
          ranked.map((team, index) => {
            const place = previewIndex(index);
            const points = maxPoints - place;
            const isDragging = drag?.id === team.id;
            const shift = isDragging ? drag.dy : (place - index) * dragStep;
            const medalClass =
              place === 0
                ? styles.rankMedalGold
                : place === 1
                ? styles.rankMedalSilver
                : place === 2
                ? styles.rankMedalBronze
                : '';
            return (
              <div
                key={team.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(team.id, el);
                  else rowRefs.current.delete(team.id);
                }}
                className={`${styles.rankRow} ${isDragging ? styles.rankRowDragging : ''}`}
                style={
                  drag
                    ? { transform: `translateY(${shift}px)`, transition: isDragging ? 'none' : 'transform 160ms ease' }
                    : undefined
                }
              >
                <div className={styles.rankRowMain}>
                  <div className={styles.rankThumbWrap}>
                    {team.photoUrl ? (
                      <img src={team.photoUrl} alt="" className={styles.rankThumb} />
                    ) : (
                      <div className={`${styles.rankThumb} ${styles.rankThumbEmpty}`}>Sin foto</div>
                    )}
                    <span className={`${styles.rankMedal} ${medalClass}`}>
                      {positionsOnly ? `${place + 1}º` : points}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={styles.rankInfo}
                    onClick={() => setExpandedId(expandedId === team.id ? null : team.id)}
                    aria-expanded={expandedId === team.id}
                    title="Ver ficha, nota y opciones"
                  >
                    <span className={styles.rankDish}>{dishName(team)}</span>
                    <span className={styles.rankTeam}>
                      {!positionsOnly && (
                        <>
                          <strong>
                            {points} {points === 1 ? 'punto' : 'puntos'}
                          </strong>{' '}
                          ·{' '}
                        </>
                      )}
                      {teamLabel(team, members)}
                    </span>
                    {renderNotePreview(team)}
                  </button>

                  <div className={styles.rankArrows}>
                    <button
                      type="button"
                      className={styles.rankArrow}
                      onClick={() => move(index, index - 1)}
                      disabled={index === 0}
                      aria-label={`Subir ${dishName(team)} un puesto`}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className={styles.rankArrow}
                      onClick={() => move(index, index + 1)}
                      disabled={index === ranked.length - 1}
                      aria-label={`Bajar ${dishName(team)} un puesto`}
                    >
                      ▼
                    </button>
                  </div>

                  <button
                    type="button"
                    className={styles.dragHandle}
                    aria-label={`Arrastrar ${dishName(team)} para cambiar su puesto`}
                    onPointerDown={(e) => handlePointerDown(e, team.id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={() => handlePointerEnd(true)}
                    onPointerCancel={() => handlePointerEnd(false)}
                  >
                    <svg className="icon" viewBox="0 0 24 24">
                      <line x1="5" y1="7" x2="19" y2="7" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <line x1="5" y1="17" x2="19" y2="17" />
                    </svg>
                  </button>
                </div>

                {expandedId === team.id &&
                  renderFicha(
                    team,
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => remove(team.id)}>
                      Quitar del ranking
                    </button>
                  )}
              </div>
            );
          })
        )}
      </div>

      {/* Tapas still to rank: tap a photo to add it */}
      {unranked.length > 0 && (
        <div className={styles.rankSection}>
          <div className={styles.rankSectionTitle}>
            {positionsOnly ? 'Probadas y sin colocar · toca para añadir' : 'Por ordenar · toca la que más te gustó'}
          </div>

          <div className={styles.pendingGrid}>
            {unranked.map((team) => (
              <Fragment key={team.id}>
                <div className={styles.pendingCard}>
                  <button
                    type="button"
                    className={styles.pendingAdd}
                    onClick={() => add(team.id)}
                    aria-label={
                      positionsOnly
                        ? `Añadir ${dishName(team)} a mi ranking`
                        : `Dar ${nextPoints} ${nextPoints === 1 ? 'punto' : 'puntos'} a ${dishName(team)}`
                    }
                  >
                    {team.photoUrl ? (
                      <img src={team.photoUrl} alt="" className={styles.pendingPhoto} />
                    ) : (
                      <div className={`${styles.pendingPhoto} ${styles.pendingPhotoEmpty}`}>Sin foto</div>
                    )}
                    <span className={styles.pendingBody}>
                      <span className={styles.rankDish}>{dishName(team)}</span>
                      <span className={styles.rankTeam}>
                        #{team.tastingOrder} · {teamLabel(team, members)}
                      </span>
                      {renderNotePreview(team)}
                    </span>
                  </button>

                  <span className={styles.pendingPoints}>{positionsOnly ? '+' : `+${nextPoints}`}</span>

                  <button
                    type="button"
                    className={styles.pendingInfoBtn}
                    onClick={() => setExpandedId(expandedId === team.id ? null : team.id)}
                    aria-expanded={expandedId === team.id}
                    aria-label={`Ver la ficha de ${dishName(team)}`}
                  >
                    <span>i</span>
                  </button>
                </div>

                {expandedId === team.id && (
                  <div className={styles.pendingFicha}>
                    {renderFicha(
                      team,
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => add(team.id)}>
                        <PlusIcon />
                        {positionsOnly ? 'Añadir a mi ranking' : `Darle ${nextPoints} ${nextPoints === 1 ? 'punto' : 'puntos'}`}
                      </button>
                    )}
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
