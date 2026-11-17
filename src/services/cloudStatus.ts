/**
 * Tracks whether the writes to Firestore are actually reaching the cloud.
 *
 * Cloud writes are fire-and-forget (the UI keeps working from the local copy), so a rejected
 * write used to be invisible: the organizer changed the phase or the draw, everything looked
 * right on their screen, and the phones kept showing the old contest. This module lets the
 * store publish those failures and the admin panel show them.
 */
export interface CloudStatus {
  failing: boolean;
  message: string | null;
}

type Listener = (status: CloudStatus) => void;

/** Failures are tracked per operation, so one successful write cannot hide another broken one. */
const failures = new Map<string, string>();
const listeners = new Set<Listener>();

let status: CloudStatus = { failing: false, message: null };

function publish(): void {
  const first = failures.entries().next();
  const next: CloudStatus = first.done
    ? { failing: false, message: null }
    : { failing: true, message: first.value[1] };
  status = next;
  listeners.forEach((listener) => listener(next));
}

function describe(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

export function reportCloudFailure(scope: string, error: unknown): void {
  console.warn(scope, error);
  failures.set(scope, `${scope}: ${describe(error)}`);
  publish();
}

export function reportCloudSuccess(scope: string): void {
  if (!failures.has(scope)) return;
  failures.delete(scope);
  publish();
}

export function getCloudStatus(): CloudStatus {
  return status;
}

export function subscribeCloudStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(status);
  return () => {
    listeners.delete(listener);
  };
}
