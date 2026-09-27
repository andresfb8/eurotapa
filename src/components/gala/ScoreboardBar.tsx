import { ScoreboardItem } from '../../types/contest';
import styles from './GalaTVView.module.css';

interface ScoreboardBarProps {
  item: ScoreboardItem;
  isPulsing: boolean;
  lastAwardedPoints?: number;
}

export function ScoreboardBar({ item, isPulsing, lastAwardedPoints }: ScoreboardBarProps) {
  const isTop1 = item.rank === 1;
  const isTop2 = item.rank === 2;
  const isTop3 = item.rank === 3;

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
          Chef: <strong>{item.name}</strong>
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
        <span className={styles.tvScoreNumber}>{item.totalPoints}</span>
        <span className={styles.tvScoreUnit}>pts</span>
      </div>
    </div>
  );
}
