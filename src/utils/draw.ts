/** Unbiased shuffle (Fisher–Yates): every order is equally likely. */
export function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Runs the draw as a short animation: the order is reshuffled a few times (so the TV shows the
 * cards moving) and the last shuffle is the result. `onDone` fires once it has settled.
 */
export function runAnimatedDraw(
  teamIds: string[],
  onReorder: (orderedIds: string[]) => void,
  onDone: () => void
): void {
  let iterations = 0;
  const interval = setInterval(() => {
    iterations++;
    onReorder(shuffled(teamIds));

    if (iterations >= 10) {
      clearInterval(interval);
      onDone();
    }
  }, 120);
}
