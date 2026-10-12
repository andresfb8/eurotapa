import { useState } from 'react';
import { Member, Team } from '../../types/contest';
import { membersOfTeam, teamLabel } from '../../utils/teams';
import { formatTastingScheduleForWhatsApp } from '../../utils/whatsappExport';
import { formatDrawDate } from '../../utils/dates';
import { runAnimatedDraw } from '../../utils/draw';
import { ConfirmDialog } from '../ConfirmDialog';
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

  return (
    <div className={styles.drawContainer}>
      <div className={styles.headerArea}>
        <div className="flex items-center justify-between">
          {isDrawDone ? (
            <span className="badge badge-green">
              Orden oficial{drawDate ? ` · sorteado el ${drawDate}` : ''}
            </span>
          ) : (
            <span className="badge badge-yellow">Sorteo pendiente</span>
          )}
          <span className="mono" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {teams.length} tapas · {members.length} participantes
          </span>
        </div>
        <h1 style={{ marginTop: '8px' }}>{isDrawDone ? 'Orden de Salida' : 'Sorteo del Orden de Salida'}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
          {isDrawDone
            ? 'Cada equipo ya conoce su turno y puede pensar y ensayar su tapa con tiempo. '
            : 'El sorteo se hace con antelación para que cada equipo sepa su turno y pueda pensar y ensayar su tapa. '}
          Las recetas e ingredientes son <strong>100% secretas</strong> y se revelarán únicamente al servir cada tapa.
        </p>
      </div>

      {canControl && (
        <div className={styles.actionsBar}>
          <div className={styles.buttonGroup}>
            {isDrawDone ? (
              <>
                <button className="btn btn-primary" onClick={handleCopyWhatsApp}>
                  <svg className="icon" viewBox="0 0 24 24">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  Compartir Orden por WhatsApp
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => setIsRedrawConfirmOpen(true)}
                  disabled={isShuffling}
                >
                  <svg className="icon" viewBox="0 0 24 24">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  {isShuffling ? 'Sorteando turnos...' : 'Repetir Sorteo'}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={handleShuffleLottery} disabled={isShuffling}>
                  <svg className="icon" viewBox="0 0 24 24">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  {isShuffling ? 'Sorteando turnos...' : 'Realizar Sorteo Aleatorio'}
                </button>

                <button className="btn btn-secondary" onClick={handleConfirmCurrentOrder} disabled={isShuffling}>
                  Fijar este orden sin sortear
                </button>
              </>
            )}
          </div>

          <button className="btn btn-secondary" onClick={onProceedToTasting}>
            Día del concurso: Comenzar Degustación
            <svg className="icon" viewBox="0 0 24 24">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}

      {canControl && (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: 'calc(-1 * var(--space-3))' }}>
          {isDrawDone
            ? 'Si surge un imprevisto, mueve un equipo con las flechas: el cambio llega al momento a los móviles y las horas se quedan en su turno.'
            : 'También puedes ordenar los equipos a mano con las flechas y fijar ese orden sin sortear.'}
        </p>
      )}

      {/* Grid showing ONLY team members and turn numbers (NO dish names, NO photos) */}
      <div className={styles.cardsGrid}>
        {sortedTeams.map((team, index) => {
          const teamMembers = membersOfTeam(team.id, members);
          return (
            <div key={team.id} className={styles.drawCard}>
              <div className={styles.orderBadge}>
                {showTurns || isShuffling ? `#${index + 1}` : '?'}
              </div>

              <div className={styles.cardContent}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--text-primary)' }}>
                  {teamLabel(team, members)}
                </div>
                <div className={styles.authorMeta}>
                  <span>
                    {!isDrawDone
                      ? teamMembers.length === 1
                        ? 'Turno por sortear'
                        : `Equipo de ${teamMembers.length} · Turno por sortear`
                      : teamMembers.length === 1
                      ? 'Turno de cocina'
                      : `Equipo de ${teamMembers.length} · Turno de cocina`}
                  </span>
                  {isDrawDone && team.tastingTime && <span>• {team.tastingTime} h</span>}
                </div>
              </div>

              {canControl && (
                <div className={styles.cardControls}>
                  <button
                    className={styles.controlBtn}
                    onClick={() => moveItem(index, 'up')}
                    disabled={index === 0 || isShuffling}
                    title="Adelantar turno"
                  >
                    ▲
                  </button>
                  <button
                    className={styles.controlBtn}
                    onClick={() => moveItem(index, 'down')}
                    disabled={index === sortedTeams.length - 1 || isShuffling}
                    title="Retrasar turno"
                  >
                    ▼
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
