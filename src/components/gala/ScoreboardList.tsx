import { useLayoutEffect, useRef, useState } from 'react';
import { ScoreboardItem } from '../../types/contest';
import { ScoreboardBar } from './ScoreboardBar';
import styles from './GalaTVView.module.css';

interface ScoreboardListProps {
  items: ScoreboardItem[];
  lastAwardedTapaId?: string;
  lastAwardedPoints?: number;
}

interface RankMotion {
  /** Bumped on every reorder so movement indicators restart their entrance. */
  id: number;
  /** teamId -> positions gained (positive = climbed, negative = dropped) */
  deltas: Record<string, number>;
}

interface Point {
  x: number;
  y: number;
}

const TRAVEL_DURATION = 520;
/** Deceleration already used by this surface (--transition-smooth) so the travel reads as part of the app. */
const TRAVEL_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
const MIN_TRAVEL_PX = 1;

/** Current visual translate, which differs from the layout position while a previous travel is still running. */
function readTranslate(el: HTMLElement): Point {
  const transform = window.getComputedStyle(el).transform;
  if (!transform || transform === 'none') return { x: 0, y: 0 };
  try {
    const matrix = new DOMMatrixReadOnly(transform);
    return { x: matrix.m41, y: matrix.m42 };
  } catch {
    const values = transform.match(/matrix(?:3d)?\((.+)\)/)?.[1].split(',').map(Number);
    if (!values) return { x: 0, y: 0 };
    return values.length >= 16 ? { x: values[12], y: values[13] } : { x: values[4] ?? 0, y: values[5] ?? 0 };
  }
}

/**
 * Renders the live standings and gives every position change a FLIP travel, so the audience
 * can follow who overtook whom instead of watching rows jump. Rows may also change column when
 * the board is split in two.
 */
export function ScoreboardList({ items, lastAwardedTapaId, lastAwardedPoints }: ScoreboardListProps) {
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const layoutRef = useRef(new Map<string, Point>());
  const ranksRef = useRef(new Map<string, number>());
  const travelAnimations = useRef(new Map<string, Animation>());
  const [motion, setMotion] = useState<RankMotion>({ id: 0, deltas: {} });

  const leaderPoints = items.reduce((max, item) => Math.max(max, item.totalPoints), 0);

  useLayoutEffect(() => {
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const previousLayout = layoutRef.current;
    const previousRanks = ranksRef.current;
    const nextLayout = new Map<string, Point>();
    const deltas: Record<string, number> = {};

    items.forEach((item) => {
      const el = rowRefs.current.get(item.teamId);
      if (!el) return;

      // offsetTop / offsetLeft are layout based: they ignore in-flight transforms and page scroll.
      const position = { x: el.offsetLeft, y: el.offsetTop };
      nextLayout.set(item.teamId, position);

      const previousRank = previousRanks.get(item.teamId);
      if (previousRank !== undefined && previousRank !== item.rank) {
        deltas[item.teamId] = previousRank - item.rank;
      }

      const previous = previousLayout.get(item.teamId);
      if (prefersReducedMotion || !previous) return;

      const inFlight = readTranslate(el);
      const travelX = previous.x - position.x + inFlight.x;
      const travelY = previous.y - position.y + inFlight.y;
      if (Math.abs(travelX) < MIN_TRAVEL_PX && Math.abs(travelY) < MIN_TRAVEL_PX) return;

      // Replace whatever travel may still be running for this row (its offset was captured above).
      travelAnimations.current.get(item.teamId)?.cancel();

      const animation = el.animate(
        [{ transform: `translate(${travelX}px, ${travelY}px)` }, { transform: 'translate(0, 0)' }],
        { duration: TRAVEL_DURATION, easing: TRAVEL_EASING }
      );
      travelAnimations.current.set(item.teamId, animation);

      const travelingClass = styles.rowTraveling;
      if (travelingClass) el.classList.add(travelingClass);
      animation.finished
        .catch(() => {})
        .then(() => {
          if (travelAnimations.current.get(item.teamId) !== animation) return;
          travelAnimations.current.delete(item.teamId);
          if (travelingClass) el.classList.remove(travelingClass);
        });
    });

    layoutRef.current = nextLayout;
    ranksRef.current = new Map(items.map((item) => [item.teamId, item.rank]));

    if (Object.keys(deltas).length > 0) {
      setMotion((previous) => ({ id: previous.id + 1, deltas }));
    }
  }, [items, lastAwardedTapaId]);

  return (
    <>
      {items.map((item) => {
        const isPulsing = lastAwardedTapaId === item.teamId;

        return (
          <div
            key={item.teamId}
            className={styles.scoreRowSlot}
            ref={(el) => {
              if (el) {
                rowRefs.current.set(item.teamId, el);
              } else {
                rowRefs.current.delete(item.teamId);
              }
            }}
          >
            <ScoreboardBar
              item={item}
              isPulsing={isPulsing}
              lastAwardedPoints={isPulsing ? lastAwardedPoints : undefined}
              leaderPoints={leaderPoints}
              rankDelta={motion.deltas[item.teamId]}
              motionId={motion.id}
            />
          </div>
        );
      })}
    </>
  );
}
