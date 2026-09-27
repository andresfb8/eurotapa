import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyB605S7wKgLvVFlXijzDlxawSeEFDeebrQ",
  authDomain: "eurotapa-2026.firebaseapp.com",
  projectId: "eurotapa-2026",
  storageBucket: "eurotapa-2026.firebasestorage.app",
  messagingSenderId: "963969407052",
  appId: "1:963969407052:web:a4fcd5f9f43aefa982bce9"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
