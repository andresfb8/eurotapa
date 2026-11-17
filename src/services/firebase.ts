import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyB605S7wKgLvVFlXijzDlxawSeEFDeebrQ",
  authDomain: "eurotapa-2026.firebaseapp.com",
  projectId: "eurotapa-2026",
  storageBucket: "eurotapa-2026.firebasestorage.app",
  messagingSenderId: "963969407052",
  appId: "1:963969407052:web:a4fcd5f9f43aefa982bce9"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

/**
 * `ignoreUndefinedProperties` is not optional here. Every contest that comes back from
 * `normalizeContest` carries its optional fields as `undefined` (`photoUrl`, `tastingTime`,
 * `lastAwardedTapaId`, `createdAt`…), and Firestore rejects any document containing an
 * `undefined` value with "Unsupported field value: undefined". Without this flag every
 * full-document write (the draw, the phase, the fichas, the teams) failed silently and stayed
 * only in the organizer's browser, while the participants kept reading the old document.
 */
export const db = (() => {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    // Firestore was already initialized (hot reload): reuse that instance.
    return getFirestore(app);
  }
})();
