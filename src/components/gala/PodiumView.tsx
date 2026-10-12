import { useState } from 'react';
import { ScoreboardItem } from '../../types/contest';
import { CheckIcon, CrownIcon } from '../Icons';
import { Confetti } from '../Confetti';
import { FullscreenButton } from '../tv/TVShell';
import tv from '../tv/TVStage.module.css';
import styles from './PodiumView.module.css';

interface PodiumViewProps {
  finalRanking: ScoreboardItem[];
  /** False on the public TV screen: only the organizer can send the contest back to the start. */
  canControl: boolean;
  onRestart: () => void;
}

export function PodiumView({ finalRanking, canControl, onRestart }: PodiumViewProps) {
  const [isCopied, setIsCopied] = useState(false);
  const first = finalRanking[0];
  const second = finalRanking[1];
  const third = finalRanking[2];

  // Fully tied tapas share the position, so the side pedestals may also be a 1º (or both a 2º)
  const sharedFirst = !!second && second.rank === 1;

  const handleShareWinners = async () => {
    let msg = `🏆 *RESULTADOS FINALES — EUROTAPA 2026* 🏆\n\n`;
    const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
    [first, second, third].forEach((item) => {
      if (!item) return;
      msg += `${medals[item.rank] ?? '🏅'} *${item.rank}º PUESTO:* ${item.name} — "${item.dishName}" (${item.totalPoints} pts)\n`;
    });
    msg += `\n`;

    msg += `*CLASIFICACIÓN GENERAL:*\n`;
    finalRanking.forEach((item) => {
      msg += `#${item.rank} ${item.name} (${item.dishName}) — ${item.totalPoints} pts\n`;
    });

    try {
      await navigator.clipboard.writeText(msg);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3500);
    } catch {
      // fallback
    }
  };

  // Pedestals are laid out 2º - 1º - 3º; the block height belongs to the slot, the number to the real rank
  const pedestal = (item: ScoreboardItem | undefined, slot: 'first' | 'second' | 'third') => {
    if (!item) return <div />;
    const blockClass =
      slot === 'first' ? styles.blockFirst : slot === 'second' ? styles.blockSecond : styles.blockThird;
    return (
      <div className={`${styles.slot} ${slot === 'first' ? styles.slotFirst : ''}`}>
        {item.photoUrl ? <img src={item.photoUrl} alt="" className={styles.photo} /> : <div className={styles.photo} />}
        <div style={{ minWidth: 0, maxWidth: '100%' }}>
          <div className={styles.dish}>{item.dishName || `Tapa de ${item.name}`}</div>
          <div className={styles.team}>{item.name}</div>
        </div>
        <div className={`${styles.block} ${blockClass}`}>
          <div className={styles.place}>{item.rank}º</div>
          <div className={styles.points}>{item.totalPoints} pts</div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.podium}>
      <Confetti count={70} />

      <div className={styles.main}>
        <div className={styles.heading}>
          <span className={tv.pill}>
            <CrownIcon />
            {sharedFirst ? 'Empate en lo más alto' : 'Tenemos campeón'}
          </span>
          <h1 className={styles.title}>El podio de EuroTapa</h1>
        </div>

        <div className={styles.pedestals}>
          {pedestal(second, 'second')}
          {pedestal(first, 'first')}
          {pedestal(third, 'third')}
        </div>
      </div>

      <aside className={styles.side}>
        <span className={tv.kicker}>Clasificación final</span>

        <div className={styles.rankList}>
          {finalRanking.map((item) => (
            <div key={item.teamId} className={styles.rankRow}>
              <b>{item.rank}º</b>
              <span>{item.dishName || `Tapa de ${item.name}`}</span>
              <i>{item.totalPoints}</i>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <button className="btn btn-primary btn-sm" onClick={handleShareWinners}>
            {isCopied && <CheckIcon />}
            {isCopied ? 'Copiado para WhatsApp' : 'Copiar resultados'}
          </button>
          {canControl && (
            <>
              <FullscreenButton />
              <button className="btn btn-secondary btn-sm" onClick={onRestart}>
                Volver al inicio
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
