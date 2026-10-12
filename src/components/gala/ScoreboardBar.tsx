import { ScoreboardItem } from '../../types/contest';
import styles from './GalaTVView.module.css';

interface ScoreboardBarProps {
  item: ScoreboardItem;
  isPulsing: boolean;
  lastAwardedPoints?: number;
  /** Points of the current leader: the bar behind the row is drawn relative to it. */
  leaderPoints: number;
  /** Positions gained since the previous reveal (positive = climbed, negative = dropped). */
  rankDelta?: number;
  /** Identifies the reorder this delta belongs to, so the indicator restarts on every movement. */
  motionId?: number;
}

export function ScoreboardBar({
  item,
  isPulsing,
  lastAwardedPoints,
  leaderPoints,
  rankDelta,
  motionId
}: ScoreboardBarProps) {
  const hasPoints = item.totalPoints > 0;
  const isTop1 = hasPoints && item.rank === 1;
  const isTop2 = hasPoints && item.rank === 2;
  const isTop3 = hasPoints && item.rank === 3;
  const hasMoved = !!rankDelta;

  const rankBadgeClass = isTop1
    ? styles.rankBadgeTop1
    : isTop2
    ? styles.rankBadgeTop2
    : isTop3
    ? styles.rankBadgeTop3
    : styles.rankBadgeDefault;

  const fill = leaderPoints > 0 ? Math.round((item.totalPoints / leaderPoints) * 100) : 0;

  return (
    <div
      className={`${styles.tvScoreRow} ${isPulsing ? styles.tvScoreRowPulsing : ''} ${
        isTop1 ? styles.tvScoreRowLeader : ''
      }`}
    >
      <div className={styles.rowFill} style={{ width: `${fill}%` }} aria-hidden="true" />

      {/* Rank indicator */}
      <div className={`${styles.tvRankBadge} ${rankBadgeClass}`}>{item.rank}º</div>

      {/* Dish Photo */}
      {item.photoUrl ? (
        <img src={item.photoUrl} alt="" className={styles.tvDishThumb} />
      ) : (
        <div className={styles.tvDishThumbPlaceholder} />
      )}

      {/* Dish & Chef Info */}
      <div className={styles.tvDishInfo}>
        <div className={styles.tvDishTitle}>{item.dishName || `Tapa de ${item.name}`}</div>
        <div className={styles.tvChefName}>{item.name}</div>
      </div>

      {/* Awarded points flash indicator */}
      {isPulsing && lastAwardedPoints && <div className={styles.tvAwardFlash}>+{lastAwardedPoints}</div>}

      {/* Score, readable from across the room */}
      <div className={styles.tvScoreBox}>
        {hasMoved && rankDelta !== undefined && (
          <span
            key={`${motionId}-${rankDelta}`}
            className={`${styles.tvRankDelta} ${rankDelta > 0 ? styles.tvRankDeltaUp : styles.tvRankDeltaDown}`}
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
