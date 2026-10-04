import { useState } from 'react';
import { Member, Team } from '../../types/contest';
import { membersOfTeam, teamLabel } from '../../utils/teams';
import { formatTastingScheduleForWhatsApp } from '../../utils/whatsappExport';
import styles from './DrawView.module.css';

interface DrawViewProps {
  title: string;
  teams: Team[];
  members: Member[];
  onReorder: (newOrderIds: string[]) => void;
  onProceedToTasting: () => void;
}

export function DrawView({ title, teams, members, onReorder, onProceedToTasting }: DrawViewProps) {
  const [isShuffling, setIsShuffling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const sortedTeams = [...teams].sort((a, b) => a.tastingOrder - b.tastingOrder);

  // Trigger lottery animation
  const handleShuffleLottery = () => {
    setIsShuffling(true);
    let iterations = 0;
    const interval = setInterval(() => {
      iterations++;
      const shuffledIds = [...teams].map((t) => t.id).sort(() => Math.random() - 0.5);
      onReorder(shuffledIds);

      if (iterations >= 10) {
        clearInterval(interval);
        setIsShuffling(false);
        showToast('Sorteo completado. Orden oficial de cocina fijado.');
      }
    }, 120);
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
  };

  // Copy WhatsApp formatted text
  const handleCopyWhatsApp = async () => {
    const text = formatTastingScheduleForWhatsApp(title, sortedTeams, members);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Horario de cocina copiado para WhatsApp.');
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
          <span className="badge badge-neutral">Fase Previa: Sorteo de Cocina</span>
          <span className="mono" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {teams.length} tapas · {members.length} participantes
          </span>
        </div>
        <h1 style={{ marginTop: '8px' }}>Sorteo del Orden de Salida</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
          Sortea los turnos de cocina para que cada equipo sepa cuándo le toca preparar su plato.
          Las recetas e ingredientes son <strong>100% secretas</strong> y se revelarán únicamente al servir cada tapa.
        </p>
      </div>

      <div className={styles.actionsBar}>
        <div className={styles.buttonGroup}>
          <button
            className="btn btn-primary"
            onClick={handleShuffleLottery}
            disabled={isShuffling}
          >
            <svg className="icon" viewBox="0 0 24 24">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            {isShuffling ? 'Sorteando turnos...' : 'Realizar Sorteo Aleatorio'}
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleCopyWhatsApp}
          >
            <svg className="icon" viewBox="0 0 24 24">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Compartir Orden por WhatsApp
          </button>
        </div>

        <button className="btn btn-primary" onClick={onProceedToTasting}>
          Comenzar Degustación
          <svg className="icon" viewBox="0 0 24 24">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Grid showing ONLY team members and turn numbers (NO dish names, NO photos) */}
      <div className={styles.cardsGrid}>
        {sortedTeams.map((team, index) => {
          const teamMembers = membersOfTeam(team.id, members);
          return (
            <div key={team.id} className={styles.drawCard}>
              <div className={styles.orderBadge}>
                #{index + 1}
              </div>

              <div className={styles.cardContent}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--text-primary)' }}>
                  {teamLabel(team, members)}
                </div>
                <div className={styles.authorMeta}>
                  <span>
                    {teamMembers.length === 1
                      ? 'Turno de cocina'
                      : `Equipo de ${teamMembers.length} · Turno de cocina`}
                  </span>
                  {team.tastingTime && <span>• {team.tastingTime} h</span>}
                </div>
              </div>

              <div className={styles.cardControls}>
                <button
                  className={styles.controlBtn}
                  onClick={() => moveItem(index, 'up')}
                  disabled={index === 0}
                  title="Adelantar turno"
                >
                  ▲
                </button>
                <button
                  className={styles.controlBtn}
                  onClick={() => moveItem(index, 'down')}
                  disabled={index === sortedTeams.length - 1}
                  title="Retrasar turno"
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>

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
