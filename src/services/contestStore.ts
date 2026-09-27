import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ContestState, Participant, VoteRecord, ContestPhase } from '../types/contest';
import { INITIAL_CONTEST_STATE } from './mockData';

const STORAGE_KEY = 'eurotapa_state_v1';
const SYNC_CHANNEL = 'eurotapa_live_sync_v1';
const FIRESTORE_DOC_ID = 'eurotapa_2026';

// Cross-tab broadcast channel for instantaneous local tab sync
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(SYNC_CHANNEL);
  }
} catch {
  // Graceful fallback
}

function loadSavedState(): ContestState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.participants && parsed.participants.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading from localStorage', e);
  }
  return INITIAL_CONTEST_STATE;
}

function persistState(state: ContestState) {
  try {
    const updated = { ...state, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (broadcastChannel) {
      broadcastChannel.postMessage(updated);
    }
    // Asynchronously sync to Firebase Firestore for cloud multi-device sync
    const docRef = doc(db, 'concursos', FIRESTORE_DOC_ID);
    setDoc(docRef, updated, { merge: true }).catch((err) => {
      console.warn('Firestore sync warning:', err);
    });
    return updated;
  } catch (e) {
    console.warn('Error persisting state', e);
    return state;
  }
}

export function useContest() {
  const [state, setState] = useState<ContestState>(loadSavedState);

  // Synchronize on Firestore snapshot, cross-tab broadcast, or window storage events
  useEffect(() => {
    // 1. Firebase Firestore Live Listener
    let unsubscribeFirestore = () => {};
    try {
      const docRef = doc(db, 'concursos', FIRESTORE_DOC_ID);
      unsubscribeFirestore = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const cloudData = snapshot.data() as ContestState;
          if (cloudData && cloudData.participants && cloudData.participants.length > 0) {
            setState(cloudData);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData));
            } catch {
              // ignore
            }
          }
        } else {
          // Initialize document in Firestore if it doesn't exist yet
          setDoc(docRef, INITIAL_CONTEST_STATE, { merge: true }).catch(() => {});
        }
      }, (error) => {
        console.warn('Firestore listener fallback to local mode:', error);
      });
    } catch (e) {
      console.warn('Firestore init error, operating in local mode:', e);
    }

    // 2. Broadcast Channel & Local Storage Listeners
    const handleBroadcast = (event: MessageEvent<ContestState>) => {
      if (event.data && event.data.id === state.id) {
        setState(event.data);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          setState(parsed);
        } catch {
          // ignore
        }
      }
    };

    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcast);
    }
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribeFirestore();
      if (broadcastChannel) {
        broadcastChannel.removeEventListener('message', handleBroadcast);
      }
      window.removeEventListener('storage', handleStorage);
    };
  }, [state.id]);

  // Actions
  const updateState = useCallback((updater: (prev: ContestState) => ContestState) => {
    setState((prev) => {
      const next = updater(prev);
      return persistState(next);
    });
  }, []);

  const setPhase = useCallback((phase: ContestPhase) => {
    updateState((prev) => ({ ...prev, phase }));
  }, [updateState]);

  const updateParticipant = useCallback((updatedParticipant: Participant) => {
    updateState((prev) => ({
      ...prev,
      participants: prev.participants.map((p) =>
        p.id === updatedParticipant.id ? updatedParticipant : p
      )
    }));
  }, [updateState]);

  const reorderTasting = useCallback((orderedIds: string[]) => {
    updateState((prev) => {
      const updatedParticipants = prev.participants.map((p) => {
        const orderIndex = orderedIds.indexOf(p.id);
        return {
          ...p,
          tastingOrder: orderIndex !== -1 ? orderIndex + 1 : p.tastingOrder
        };
      });
      return { ...prev, participants: updatedParticipants };
    });
  }, [updateState]);

  const submitVote = useCallback((vote: VoteRecord) => {
    updateState((prev) => ({
      ...prev,
      votes: {
        ...prev.votes,
        [vote.voterId]: vote
      }
    }));
  }, [updateState]);

  const setActiveTasting = useCallback((participantId: string) => {
    updateState((prev) => ({ ...prev, activeTastingId: participantId }));
  }, [updateState]);

  const setGalaState = useCallback((updater: (prevGala: ContestState['gala']) => ContestState['gala']) => {
    updateState((prev) => ({
      ...prev,
      gala: updater(prev.gala)
    }));
  }, [updateState]);

  /**
   * Eurovision Gala Controller Step:
   * Reveals points strictly ONE BY ONE, starting from the lowest (1 pt) up to the maximum score,
   * then advances to the next voter.
   */
  const nextGalaStep = useCallback(() => {
    updateState((prev) => {
      const votersList = prev.participants.filter((p) => !!prev.votes[p.id]);
      if (votersList.length === 0) return prev;

      const currentIdx = prev.gala.currentVoterIndex;
      const currentVoter = votersList[currentIdx];
      if (!currentVoter) {
        // Gala finished -> Podium
        return { ...prev, phase: 'PODIO' };
      }

      const voteRecord = prev.votes[currentVoter.id];
      if (!voteRecord) return prev;

      // Sort points ascending (1, 2, 3... up to max)
      const sortedEntriesAscending = Object.entries(voteRecord.scores).sort((a, b) => a[1] - b[1]);

      // Find the next point entry that hasn't been revealed yet
      const nextToReveal = sortedEntriesAscending.find(
        ([tapaId]) => !prev.gala.revealedTapaIds.includes(tapaId)
      );

      if (nextToReveal) {
        // Reveal this single point!
        const [tapaId, points] = nextToReveal;
        return {
          ...prev,
          gala: {
            ...prev.gala,
            step: 'REVELANDO_PUNTOS',
            revealedTapaIds: [...prev.gala.revealedTapaIds, tapaId],
            lastAwardedTapaId: tapaId,
            lastAwardedPoints: points
          }
        };
      } else {
        // All points for current voter have been announced! Advance to next voter
        const nextIdx = currentIdx + 1;
        if (nextIdx >= votersList.length) {
          return {
            ...prev,
            phase: 'PODIO',
            gala: {
              ...prev.gala,
              currentVoterIndex: nextIdx,
              step: 'COMPLETO',
              lastAwardedTapaId: undefined,
              lastAwardedPoints: undefined
            }
          };
        } else {
          return {
            ...prev,
            gala: {
              currentVoterIndex: nextIdx,
              step: 'ESPERANDO',
              revealedTapaIds: [],
              lastAwardedTapaId: undefined,
              lastAwardedPoints: undefined
            }
          };
        }
      }
    });
  }, [updateState]);

  /**
   * Helper to instantly simulate realistic votes for all participants
   */
  const simulateSampleVotes = useCallback(() => {
    updateState((prev) => {
      const generatedVotes: Record<string, VoteRecord> = {};
      const N = prev.participants.length;

      prev.participants.forEach((voter) => {
        // Exclude the voter's own tapa
        const rivalTapas = prev.participants.filter((p) => p.id !== voter.id);
        const shuffled = [...rivalTapas].sort(() => Math.random() - 0.5);

        const scores: Record<string, number> = {};
        shuffled.forEach((rival, idx) => {
          scores[rival.id] = (N - 1) - idx;
        });

        generatedVotes[voter.id] = {
          voterId: voter.id,
          voterName: voter.name,
          scores,
          submittedAt: new Date().toISOString()
        };
      });

      return {
        ...prev,
        votes: generatedVotes,
        phase: 'GALA_TV',
        gala: {
          currentVoterIndex: 0,
          step: 'ESPERANDO',
          revealedTapaIds: []
        }
      };
    });
  }, [updateState]);

  const resetContest = useCallback(() => {
    updateState(() => INITIAL_CONTEST_STATE);
  }, [updateState]);

  return {
    state,
    setPhase,
    updateParticipant,
    reorderTasting,
    submitVote,
    setActiveTasting,
    setGalaState,
    nextGalaStep,
    simulateSampleVotes,
    resetContest
  };
}
