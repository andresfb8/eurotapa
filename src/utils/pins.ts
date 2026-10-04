/** Master PIN that always opens the superadmin console. Never assigned to members. */
export const MASTER_PIN = '9999';

const PIN_RANGE_START = 1001;
const PIN_RANGE_END = 1099;

type PinHolder = { id: string; pin: string };

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin.trim());
}

export function isPinTaken(participants: PinHolder[], pin: string, exceptParticipantId?: string): boolean {
  return participants.some((p) => p.pin === pin && p.id !== exceptParticipantId);
}

/**
 * Returns a PIN that is unique inside a single contest.
 * Prefers `preferred` when it is a valid, free 4-digit code, then fills the first free slot
 * in 1001-1099 and finally falls back to a random free code.
 */
export function generateUniquePin(participants: PinHolder[], preferred?: string): string {
  const candidate = (preferred || '').trim();
  if (isValidPin(candidate) && candidate !== MASTER_PIN && !isPinTaken(participants, candidate)) {
    return candidate;
  }

  for (let value = PIN_RANGE_START; value <= PIN_RANGE_END; value++) {
    const pin = String(value);
    if (!isPinTaken(participants, pin)) return pin;
  }

  for (let attempt = 0; attempt < 500; attempt++) {
    const pin = String(1000 + Math.floor(Math.random() * 9000));
    if (pin !== MASTER_PIN && !isPinTaken(participants, pin)) return pin;
  }

  return String(PIN_RANGE_START);
}
