import { CSSProperties, useMemo } from 'react';

interface ConfettiProps {
  /** Number of pieces. */
  count?: number;
  /** Change it to replay the burst. */
  burstKey?: string | number;
}

/** A burst of CSS confetti that fills its nearest positioned ancestor. Decorative only. */
export function Confetti({ count = 36, burstKey }: ConfettiProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i * 97) % 100}%`,
        delay: `${(i * 53) % 900}ms`,
        drift: `${((i * 37) % 60) - 30}vw`,
        spin: `${360 + ((i * 71) % 720)}deg`,
        size: `${0.7 + ((i * 13) % 6) / 10}em`
      })),
    [count]
  );

  return (
    <div className="confetti" aria-hidden="true" key={burstKey}>
      {pieces.map((piece, i) => (
        <i
          key={i}
          style={
            {
              left: piece.left,
              animationDelay: piece.delay,
              fontSize: piece.size,
              '--drift': piece.drift,
              '--spin': piece.spin
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
