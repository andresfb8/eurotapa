import { ScoreboardItem } from '../../types/contest';
import styles from './GalaTVView.module.css';

interface ScoreboardBarProps {
  item: ScoreboardItem;
  isPulsing: boolean;
  lastAwardedPoints?: number;
  /** Positions gained since the previous reveal (positive = climbed, negative = dropped). */
  rankDelta?: number;
  /** Identifies the reorder this delta belongs to, so the indicator restarts on every movement. */
  motionId?: number;
}

export function ScoreboardBar({
  item,
  isPulsing,
  lastAwardedPoints,
  rankDelta,
  motionId
}: ScoreboardBarProps) {
  const isTop1 = item.rank === 1;
  const isTop2 = item.rank === 2;
  const isTop3 = item.rank === 3;
  const hasMoved = !!rankDelta;

  const rankBadgeClass = isTop1
    ? styles.rankBadgeTop1
    : isTop2
    ? styles.rankBadgeTop2
    : isTop3
    ? styles.rankBadgeTop3
    : styles.rankBadgeDefault;

  return (
    <div
      className={`${styles.tvScoreRow} ${isPulsing ? styles.tvScoreRowPulsing : ''} ${
        isTop1 ? styles.tvScoreRowLeader : ''
      }`}
    >
      {/* Rank indicator */}
      <div className={`${styles.tvRankBadge} ${rankBadgeClass}`}>
        {isTop1 ? '1º' : isTop2 ? '2º' : isTop3 ? '3º' : `${item.rank}º`}
      </div>

      {/* Dish Photo */}
      {item.photoUrl ? (
        <img src={item.photoUrl} alt={item.dishName} className={styles.tvDishThumb} />
      ) : (
        <div className={styles.tvDishThumbPlaceholder}>
          <svg className="icon" viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </div>
      )}

      {/* Dish & Chef Info */}
      <div className={styles.tvDishInfo}>
        <div className={styles.tvDishTitle}>{item.dishName}</div>
        <div className={styles.tvChefName}>
          Equipo: <strong>{item.name}</strong>
        </div>
      </div>

      {/* Awarded points flash indicator */}
      {isPulsing && lastAwardedPoints && (
        <div className={styles.tvAwardFlash}>
          +{lastAwardedPoints}
        </div>
      )}

      {/* Prominent Score Box (Optimized for 27" monitor reading) */}
      <div className={styles.tvScoreBox}>
        {hasMoved && rankDelta !== undefined && (
          <span
            key={`${motionId}-${rankDelta}`}
            className={`${styles.tvRankDelta} ${
              rankDelta > 0 ? styles.tvRankDeltaUp : styles.tvRankDeltaDown
            }`}
            role="img"
            aria-label={
              rankDelta > 0
                ? `Sube ${rankDelta} ${rankDelta === 1 ? 'puesto' : 'puestos'}`
                : `Baja ${Math.abs(rankDelta)} ${Math.abs(rankDelta) === 1 ? 'puesto' : 'puestos'}`
            }
          >
            <svg className={styles.tvRankDeltaIcon} viewBox="0 0 10 8" aria-hidden="true">
              {rankDelta > 0 ? <path d="M5 0 10 8H0z" /> : <path d="M5 8 0 0h10z" />}
            </svg>
            {Math.abs(rankDelta)}
          </span>
        )}
        <span className={styles.tvScoreNumber}>{item.totalPoints}</span>
        <span className={styles.tvScoreUnit}>pts</span>
      </div>
    </div>
  );
}
