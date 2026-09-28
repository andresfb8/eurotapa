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
  /** participantId -> positions gained (positive = climbed, negative = dropped) */
  deltas: Record<string, number>;
}

const TRAVEL_DURATION = 460;
/** Deceleration already used by this surface (--transition-smooth) so the travel reads as part of the app. */
const TRAVEL_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
const MIN_TRAVEL_PX = 1;

/** Current visual translateY, which differs from the layout position while a previous travel is still running. */
function readTranslateY(el: HTMLElement): number {
  const transform = window.getComputedStyle(el).transform;
  if (!transform || transform === 'none') return 0;
  try {
    return new DOMMatrixReadOnly(transform).m42;
  } catch {
    const values = transform.match(/matrix(?:3d)?\((.+)\)/)?.[1].split(',').map(Number);
    if (!values) return 0;
    return values.length >= 16 ? values[13] : values[5] ?? 0;
  }
}

/**
 * Renders the live standings and gives every position change a FLIP travel, so the audience
 * can follow who overtook whom instead of watching rows jump.
 */
export function ScoreboardList({ items, lastAwardedTapaId, lastAwardedPoints }: ScoreboardListProps) {
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const layoutTopsRef = useRef(new Map<string, number>());
  const ranksRef = useRef(new Map<string, number>());
  const travelAnimations = useRef(new Map<string, Animation>());
  const [motion, setMotion] = useState<RankMotion>({ id: 0, deltas: {} });

  useLayoutEffect(() => {
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const previousTops = layoutTopsRef.current;
    const previousRanks = ranksRef.current;
    const nextTops = new Map<string, number>();
    const deltas: Record<string, number> = {};

    items.forEach((item) => {
      const el = rowRefs.current.get(item.participantId);
      if (!el) return;

      // offsetTop is layout based: it ignores in-flight transforms and page scroll.
      const top = el.offsetTop;
      nextTops.set(item.participantId, top);

      const previousRank = previousRanks.get(item.participantId);
      if (previousRank !== undefined && previousRank !== item.rank) {
        deltas[item.participantId] = previousRank - item.rank;
      }

      const previousTop = previousTops.get(item.participantId);
      if (prefersReducedMotion || previousTop === undefined) return;

      const inFlight = readTranslateY(el);
      const travel = previousTop - top + inFlight;
      if (Math.abs(travel) < MIN_TRAVEL_PX) return;

      // Replace whatever travel may still be running for this row (its offset was captured above).
      travelAnimations.current.get(item.participantId)?.cancel();

      // Keep the scale of the row that just received points, so the pulse survives the travel.
      const scale = lastAwardedTapaId === item.participantId ? ' scale(1.02)' : '';
      const animation = el.animate(
        [
          { transform: `translateY(${travel}px)${scale}` },
          { transform: `translateY(0)${scale}` }
        ],
        { duration: TRAVEL_DURATION, easing: TRAVEL_EASING }
      );
      travelAnimations.current.set(item.participantId, animation);

      const travelingClass = styles.rowTraveling;
      if (travelingClass) el.classList.add(travelingClass);
      animation.finished
        .catch(() => {})
        .then(() => {
          if (travelAnimations.current.get(item.participantId) !== animation) return;
          travelAnimations.current.delete(item.participantId);
          if (travelingClass) el.classList.remove(travelingClass);
        });
    });

    layoutTopsRef.current = nextTops;
    ranksRef.current = new Map(items.map((item) => [item.participantId, item.rank]));

    if (Object.keys(deltas).length > 0) {
      setMotion((previous) => ({ id: previous.id + 1, deltas }));
    }
  }, [items, lastAwardedTapaId]);

  return (
    <>
      {items.map((item) => {
        const isPulsing = lastAwardedTapaId === item.participantId;

        return (
          <div
            key={item.participantId}
            className={styles.scoreRowSlot}
            ref={(el) => {
              if (el) {
                rowRefs.current.set(item.participantId, el);
              } else {
                rowRefs.current.delete(item.participantId);
              }
            }}
          >
            <ScoreboardBar
              item={item}
              isPulsing={isPulsing}
              lastAwardedPoints={isPulsing ? lastAwardedPoints : undefined}
              rankDelta={motion.deltas[item.participantId]}
              motionId={motion.id}
            />
          </div>
        );
      })}
    </>
  );
}
