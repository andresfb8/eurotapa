import { CSSProperties, useState } from 'react';
import { Member, Team } from '../../types/contest';
import { membersOfTeam, teamLabel } from '../../utils/teams';
import { formatTastingScheduleForWhatsApp } from '../../utils/whatsappExport';
import { formatDrawDate } from '../../utils/dates';
import { runAnimatedDraw } from '../../utils/draw';
import { ConfirmDialog } from '../ConfirmDialog';
import { FullscreenButton } from '../tv/TVShell';
import tv from '../tv/TVStage.module.css';
import styles from './DrawView.module.css';

interface DrawViewProps {
  title: string;
  teams: Team[];
  members: Member[];
  /** ISO date when the official order was fixed; missing while the draw is still pending. */
  drawDoneAt?: string;
  /** False on the public TV screen: it only displays, the organizer drives from the admin console. */
  canControl: boolean;
  onReorder: (newOrderIds: string[]) => void;
  onConfirmDraw: () => void;
  onProceedToTasting: () => void;
}

export function DrawView({
  title,
  teams,
  members,
  drawDoneAt,
  canControl,
  onReorder,
  onConfirmDraw,
  onProceedToTasting
}: DrawViewProps) {
  const [isShuffling, setIsShuffling] = useState(false);
  const [isRedrawConfirmOpen, setIsRedrawConfirmOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const sortedTeams = [...teams].sort((a, b) => a.tastingOrder - b.tastingOrder);
  const isDrawDone = !!drawDoneAt;
  const drawDate = drawDoneAt ? formatDrawDate(drawDoneAt) : '';
  // Until the draw is official the turn numbers mean nothing, so only the organizer sees them
  const showTurns = isDrawDone || canControl;

  // Trigger lottery animation
  const handleShuffleLottery = () => {
    setIsRedrawConfirmOpen(false);
    setIsShuffling(true);
    runAnimatedDraw(
      teams.map((t) => t.id),
      onReorder,
      () => {
        setIsShuffling(false);
        onConfirmDraw();
        showToast('Sorteo completado. Orden oficial fijado: compártelo con los equipos.');
      }
    );
  };

  // Makes the order on screen official without a random draw
  const handleConfirmCurrentOrder = () => {
    onConfirmDraw();
    showToast('Orden oficial fijado: compártelo con los equipos.');
  };

  // Move item up or down manually
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sortedTeams.length) return;

    const copy = [...sortedTeams];
    const temp = copy[index];
    copy[index] = copy[newIndex];
    copy[newIndex] = temp;

    onReorder(copy.map((t) => t.id));
    if (isDrawDone) {
      showToast('Orden actualizado. Los equipos ya lo ven en su móvil; vuelve a compartirlo si hace falta.');
    }
  };

  // Copy WhatsApp formatted text
  const handleCopyWhatsApp = async () => {
    const text = formatTastingScheduleForWhatsApp(title, sortedTeams, members);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Orden de salida copiado para WhatsApp.');
    } catch {
      showToast('Error al copiar al portapapeles.');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // As square a grid as fits a wide screen: 8 tapas -> 4 x 2, 12 -> 4 x 3
  const columns = Math.max(1, Math.ceil(Math.sqrt(sortedTeams.length * 1.8)));
  const rows = Math.max(1, Math.ceil(sortedTeams.length / columns));
  const gridStyle = { '--cols': columns, '--rows': rows } as CSSProperties;

  return (
    <div className={styles.draw}>
      <div className={styles.header}>
        <div>
          <span className={`${tv.pill} ${isDrawDone ? '' : tv.pillLive}`}>
            {isDrawDone ? `Orden oficial${drawDate ? ` · sorteado el ${drawDate}` : ''}` : 'Sorteo pendiente'}
          </span>
          <h1 className={styles.title}>{isDrawDone ? 'Orden de salida' : 'Sorteo del orden de salida'}</h1>
        </div>
        <p className={styles.lead}>
          {isDrawDone
            ? 'Cada equipo ya conoce su turno y puede pensar y ensayar su tapa con tiempo.'
            : 'El sorteo se hace con antelación para que cada equipo sepa su turno y pueda ensayar su tapa.'}{' '}
          Las tapas son <strong>secretas</strong> hasta que se sirven.
        </p>
      </div>

      {/* Only team members and turn numbers: no dish names, no photos */}
      <div className={styles.grid} style={gridStyle}>
        {sortedTeams.map((team, index) => {
          const teamMembers = membersOfTeam(team.id, members);
          const showNumber = showTurns || isShuffling;
          return (
            // The key changes with the position, so a card that moves replays its entrance
            <div key={`${team.id}-${index}`} className={styles.card} style={{ animationDelay: `${index * 45}ms` }}>
              <div className={`${styles.number} ${showNumber ? '' : styles.numberHidden}`}>
                {showNumber ? index + 1 : '?'}
              </div>

              <div className={styles.cardBody}>
                <div className={styles.names}>{teamLabel(team, members)}</div>
                <div className={styles.meta}>
                  {!isDrawDone
                    ? 'Turno por sortear'
                    : teamMembers.length === 1
                    ? 'Turno de cocina'
                    : `Equipo de ${teamMembers.length}`}
                  {isDrawDone && team.tastingTime && ` · ${team.tastingTime} h`}
                </div>
              </div>

              {canControl && (
                <div className={styles.cardControls}>
                  <button
                    className={styles.controlBtn}
                    onClick={() => moveItem(index, 'up')}
                    disabled={index === 0 || isShuffling}
                    title="Adelantar turno"
                    aria-label={`Adelantar el turno de ${teamLabel(team, members)}`}
                  >
                    ▲
                  </button>
                  <button
                    className={styles.controlBtn}
                    onClick={() => moveItem(index, 'down')}
                    disabled={index === sortedTeams.length - 1 || isShuffling}
                    title="Retrasar turno"
                    aria-label={`Retrasar el turno de ${teamLabel(team, members)}`}
                  >
                    ▼
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {canControl && (
        <div className={tv.controlBar}>
          <div className={tv.controlGroup}>
            {isDrawDone ? (
              <>
                <button className="btn btn-primary btn-sm" onClick={handleCopyWhatsApp}>
                  <svg className="icon" viewBox="0 0 24 24">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  Compartir Orden por WhatsApp
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsRedrawConfirmOpen(true)}
                  disabled={isShuffling}
                >
                  {isShuffling ? 'Sorteando turnos...' : 'Repetir Sorteo'}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary btn-sm" onClick={handleShuffleLottery} disabled={isShuffling}>
                  {isShuffling ? 'Sorteando turnos...' : 'Realizar Sorteo Aleatorio'}
                </button>

                <button className="btn btn-secondary btn-sm" onClick={handleConfirmCurrentOrder} disabled={isShuffling}>
                  Fijar este orden sin sortear
                </button>
              </>
            )}
            <FullscreenButton />
            <span className={tv.controlHint}>
              {isDrawDone
                ? 'Imprevisto: mueve un equipo con sus flechas; el cambio llega a los móviles.'
                : 'También puedes ordenar a mano con las flechas y fijar ese orden.'}
            </span>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={onProceedToTasting}>
            Día del concurso: Comenzar Degustación
            <svg className="icon" viewBox="0 0 24 24">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}

      {isRedrawConfirmOpen && (
        <ConfirmDialog
          title="¿Repetir el sorteo?"
          confirmLabel="Sí, sortear de nuevo"
          cancelLabel="Mantener el orden actual"
          onConfirm={handleShuffleLottery}
          onCancel={() => setIsRedrawConfirmOpen(false)}
        >
          <p>
            Los equipos ya conocen su turno{drawDate ? ` desde el ${drawDate}` : ''} y pueden estar preparando su tapa
            contando con él. Un sorteo nuevo cambia todos los turnos a la vez.
          </p>
          <p style={{ marginTop: '8px' }}>
            Para un imprevisto concreto es mejor mover solo los equipos afectados con las flechas.
          </p>
        </ConfirmDialog>
      )}

      {toastMessage && (
        <div className={styles.toast}>
          <svg className="icon" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
