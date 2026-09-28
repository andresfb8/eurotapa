/**
 * Public URL used to build the access links that are sent to participants.
 * Configurable with VITE_PUBLIC_URL, falls back to the Firebase Hosting site.
 * In development this must NOT be localhost, otherwise the links only work on the organiser's machine.
 */
const DEFAULT_PUBLIC_URL = 'https://eurotapa-2026.web.app';

function normalizeBaseUrl(url: string): string {
  let value = url.trim().replace(/\/+$/, '');
  if (value && !/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  return value;
}

export function getPublicAppBaseUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_URL;
  if (typeof configured === 'string' && configured.trim().length > 0) {
    return normalizeBaseUrl(configured);
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    return normalizeBaseUrl(window.location.origin);
  }
  return DEFAULT_PUBLIC_URL;
}

/** True when the app is being served from a private/local address, so shared links would be useless. */
export function isLocalOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1' || host === '[::1]') {
    return true;
  }
  if (host.endsWith('.local') || host.endsWith('.localhost')) return true;
  if (/^10\./.test(host) || /^192\.168\./.test(host)) return true;
  return /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

function buildUrl(params: Record<string, string>): string {
  return `${getPublicAppBaseUrl()}/?${new URLSearchParams(params).toString()}`;
}

/** Personal link that takes a participant straight into their own space. */
export function buildParticipantLink(contestId: string, pin: string): string {
  return buildUrl({ c: contestId, pin });
}

/** Link that opens a contest directly in TV / projection mode. */
export function buildTvLink(contestId: string): string {
  return buildUrl({ c: contestId, role: 'tv' });
}
