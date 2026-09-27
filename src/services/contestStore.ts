import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  ContestState,
  Participant,
  VoteRecord,
  ContestPhase,
  UserSession,
  UserRole,
  MultiContestData
} from '../types/contest';
import { INITIAL_CONTEST_STATE } from './mockData';

const MULTI_STORAGE_KEY = 'eurotapa_multicontest_v2';
const LEGACY_STORAGE_KEY = 'eurotapa_state_v1';
const SESSION_STORAGE_KEY = 'eurotapa_session_v2';
const SYNC_CHANNEL = 'eurotapa_live_sync_v2';

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(SYNC_CHANNEL);
  }
} catch {
  // Graceful fallback
}

function loadInitialMultiData(): MultiContestData {
  try {
    const raw = localStorage.getItem(MULTI_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MultiContestData;
      if (parsed && parsed.contests && Object.keys(parsed.contests).length > 0) {
        return parsed;
      }
    }

    // Check for legacy migration
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const parsedLegacy = JSON.parse(legacyRaw) as ContestState;
      if (parsedLegacy && parsedLegacy.id) {
        return {
          activeContestId: parsedLegacy.id,
          contests: {
            [parsedLegacy.id]: parsedLegacy
          }
        };
      }
    }
  } catch (e) {
    console.warn('Error reading multi data from localStorage', e);
  }

  return {
    activeContestId: INITIAL_CONTEST_STATE.id,
    contests: {
      [INITIAL_CONTEST_STATE.id]: {
        ...INITIAL_CONTEST_STATE,
        code: 'EURO26'
      }
    }
  };
}

function loadSavedSession(): UserSession | null {
  try {
    // 1. Check URL parameters for fast direct link
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const urlPin = params.get('pin') || params.get('code');
      const urlRole = params.get('role');
      const urlContestId = params.get('c') || params.get('contest');

      if (urlRole === 'tv') {
        return {
          role: 'tv',
          contestId: urlContestId || INITIAL_CONTEST_STATE.id
        };
      }

      if (urlPin) {
        const trimmedPin = urlPin.trim();
        // If master pin
        if (trimmedPin === '9999') {
          return {
            role: 'superadmin',
            contestId: urlContestId || INITIAL_CONTEST_STATE.id
          };
        }

        // Check if participant
        const multi = loadInitialMultiData();
        const contest = urlContestId ? multi.contests[urlContestId] : multi.contests[multi.activeContestId];
        if (contest) {
          const matched = contest.participants.find((p) => p.pin === trimmedPin);
          if (matched) {
            return {
              role: 'participant',
              contestId: contest.id,
              participantId: matched.id
            };
          }
        }
      }
    }

    // 2. Check localStorage session
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.role && parsed.contestId) {
        return parsed as UserSession;
      }
    }
  } catch (e) {
    console.warn('Error loading session:', e);
  }
  return null;
}

function persistMultiData(data: MultiContestData): MultiContestData {
  try {
    localStorage.setItem(MULTI_STORAGE_KEY, JSON.stringify(data));
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'MULTI_UPDATE', data });
    }

    // Async sync active contest to Firestore
    const active = data.contests[data.activeContestId];
    if (active) {
      const docRef = doc(db, 'concursos', active.id);
      setDoc(docRef, active, { merge: true }).catch((err) => {
        console.warn('Firestore active contest sync warning:', err);
      });
    }

    // Also persist registry list
    const registryRef = doc(db, 'app_meta', 'registry');
    const contestSummaries = Object.values(data.contests).map((c) => ({
      id: c.id,
      title: c.title,
      code: c.code || '',
      phase: c.phase,
      participantsCount: c.participants.length,
      updatedAt: c.updatedAt
    }));
    setDoc(registryRef, { contests: contestSummaries, activeContestId: data.activeContestId }, { merge: true }).catch(() => {});

    return data;
  } catch (e) {
    console.warn('Error persisting multi data:', e);
    return data;
  }
}

export function useContest() {
  const [multiData, setMultiData] = useState<MultiContestData>(loadInitialMultiData);
  const [session, setSession] = useState<UserSession | null>(loadSavedSession);

  // Active contest is either from session contestId or activeContestId
  const activeContestId = session?.contestId || multiData.activeContestId;
  const currentContest = multiData.contests[activeContestId] || multiData.contests[multiData.activeContestId] || INITIAL_CONTEST_STATE;

  // Persist session changes
  const saveSession = useCallback((newSession: UserSession | null) => {
    setSession(newSession);
    try {
      if (newSession) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  // Listeners: Firestore & Cross-Tab Broadcast & Window Storage
  useEffect(() => {
    // 1. Firebase Firestore Live Listener for current contest
    let unsubscribeFirestore = () => {};
    try {
      const docRef = doc(db, 'concursos', activeContestId);
      unsubscribeFirestore = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const cloudContest = snapshot.data() as ContestState;
            if (cloudContest && cloudContest.id && cloudContest.participants) {
              setMultiData((prev) => {
                const next = {
                  ...prev,
                  contests: {
                    ...prev.contests,
                    [cloudContest.id]: cloudContest
                  }
                };
                localStorage.setItem(MULTI_STORAGE_KEY, JSON.stringify(next));
                return next;
              });
            }
          }
        },
        (error) => {
          console.warn('Firestore live listener offline or error:', error);
        }
      );
    } catch (e) {
      console.warn('Firestore subscription error:', e);
    }

    // 2. Broadcast Channel
    const handleBroadcast = (event: MessageEvent) => {
      if (event.data?.type === 'MULTI_UPDATE' && event.data.data) {
        setMultiData(event.data.data);
      }
    };

    // 3. Local Storage Sync
    const handleStorage = (event: StorageEvent) => {
      if (event.key === MULTI_STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          setMultiData(parsed);
        } catch {
          // ignore
        }
      }
      if (event.key === SESSION_STORAGE_KEY) {
        try {
          setSession(event.newValue ? JSON.parse(event.newValue) : null);
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
  }, [activeContestId]);

  // General Updater for the current contest
  const updateCurrentContest = useCallback(
    (updater: (prev: ContestState) => ContestState) => {
      setMultiData((prev) => {
        const contest = prev.contests[activeContestId] || INITIAL_CONTEST_STATE;
        const updatedContest = {
          ...updater(contest),
          updatedAt: new Date().toISOString()
        };

        const nextMulti: MultiContestData = {
          ...prev,
          contests: {
            ...prev.contests,
            [activeContestId]: updatedContest
          }
        };

        return persistMultiData(nextMulti);
      });
    },
    [activeContestId]
  );

  // Contest-specific Actions
  const setPhase = useCallback(
    (phase: ContestPhase) => {
      updateCurrentContest((prev) => ({ ...prev, phase }));
    },
    [updateCurrentContest]
  );

  const updateParticipant = useCallback(
    (updatedParticipant: Participant) => {
      updateCurrentContest((prev) => ({
        ...prev,
        participants: prev.participants.map((p) =>
          p.id === updatedParticipant.id ? updatedParticipant : p
        )
      }));
    },
    [updateCurrentContest]
  );

  const reorderTasting = useCallback(
    (orderedIds: string[]) => {
      updateCurrentContest((prev) => {
        const updatedParticipants = prev.participants.map((p) => {
          const orderIndex = orderedIds.indexOf(p.id);
          return {
            ...p,
            tastingOrder: orderIndex !== -1 ? orderIndex + 1 : p.tastingOrder
          };
        });
        return { ...prev, participants: updatedParticipants };
      });
    },
    [updateCurrentContest]
  );

  const submitVote = useCallback(
    (vote: VoteRecord) => {
      updateCurrentContest((prev) => ({
        ...prev,
        votes: {
          ...prev.votes,
          [vote.voterId]: vote
        }
      }));
    },
    [updateCurrentContest]
  );

  const setActiveTasting = useCallback(
    (participantId: string) => {
      updateCurrentContest((prev) => ({ ...prev, activeTastingId: participantId }));
    },
    [updateCurrentContest]
  );

  const nextGalaStep = useCallback(() => {
    updateCurrentContest((prev) => {
      const votersList = prev.participants.filter((p) => !!prev.votes[p.id]);
      if (votersList.length === 0) return prev;

      const currentIdx = prev.gala.currentVoterIndex;
      const currentVoter = votersList[currentIdx];
      if (!currentVoter) {
        return { ...prev, phase: 'PODIO' };
      }

      const voteRecord = prev.votes[currentVoter.id];
      if (!voteRecord) return prev;

      const sortedEntriesAscending = Object.entries(voteRecord.scores).sort((a, b) => a[1] - b[1]);

      const nextToReveal = sortedEntriesAscending.find(
        ([tapaId]) => !prev.gala.revealedTapaIds.includes(tapaId)
      );

      if (nextToReveal) {
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
  }, [updateCurrentContest]);

  const simulateSampleVotes = useCallback(() => {
    updateCurrentContest((prev) => {
      const generatedVotes: Record<string, VoteRecord> = {};
      const N = prev.participants.length;

      prev.participants.forEach((voter) => {
        const rivalTapas = prev.participants.filter((p) => p.id !== voter.id);
        const shuffled = [...rivalTapas].sort(() => Math.random() - 0.5);

        const scores: Record<string, number> = {};
        shuffled.forEach((rival, idx) => {
          scores[rival.id] = N - 1 - idx;
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
  }, [updateCurrentContest]);

  const resetContest = useCallback(() => {
    updateCurrentContest((prev) => ({
      ...prev,
      phase: 'SORTEO',
      votes: {},
      gala: {
        currentVoterIndex: 0,
        step: 'ESPERANDO',
        revealedTapaIds: []
      }
    }));
  }, [updateCurrentContest]);

  // ==========================================
  // MULTI-CONTEST MANAGEMENT (FOR SUPERADMIN)
  // ==========================================

  const createContest = useCallback(
    (
      title: string,
      code?: string,
      adminPin: string = '9999',
      initialParticipants: { name: string; pin: string }[] = []
    ) => {
      const contestId = 'contest_' + Date.now().toString(36);
      const cleanCode = (code || title.substring(0, 4).toUpperCase() + Math.floor(10 + Math.random() * 90)).trim().toUpperCase();

      const participants: Participant[] = initialParticipants.map((p, idx) => ({
        id: `p_${idx + 1}_${Date.now().toString(36)}`,
        name: p.name,
        pin: p.pin || (1001 + idx).toString(),
        dishName: '',
        ingredients: [],
        description: '',
        tastingOrder: idx + 1
      }));

      const newContest: ContestState = {
        id: contestId,
        title: title.trim() || 'Nuevo Concurso de Tapas',
        code: cleanCode,
        phase: 'CONFIGURACION',
        adminPin: adminPin.trim() || '9999',
        participants: participants.length > 0 ? participants : [
          { id: 'p_1', name: 'Participante 1', pin: '1001', dishName: '', ingredients: [], description: '', tastingOrder: 1 },
          { id: 'p_2', name: 'Participante 2', pin: '1002', dishName: '', ingredients: [], description: '', tastingOrder: 2 },
          { id: 'p_3', name: 'Participante 3', pin: '1003', dishName: '', ingredients: [], description: '', tastingOrder: 3 },
        ],
        votes: {},
        gala: {
          currentVoterIndex: 0,
          step: 'ESPERANDO',
          revealedTapaIds: []
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setMultiData((prev) => {
        const next: MultiContestData = {
          activeContestId: contestId,
          contests: {
            ...prev.contests,
            [contestId]: newContest
          }
        };
        return persistMultiData(next);
      });

      return contestId;
    },
    []
  );

  const switchContest = useCallback((contestId: string) => {
    setMultiData((prev) => {
      if (!prev.contests[contestId]) return prev;
      const next: MultiContestData = {
        ...prev,
        activeContestId: contestId
      };
      return persistMultiData(next);
    });

    // If currently logged in, update session contestId
    setSession((prevSession) => {
      if (!prevSession) return null;
      const updated = { ...prevSession, contestId };
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const deleteContest = useCallback(
    (contestId: string) => {
      setMultiData((prev) => {
        const contestKeys = Object.keys(prev.contests);
        if (contestKeys.length <= 1) {
          alert('No puedes eliminar el único concurso disponible.');
          return prev;
        }

        const remaining = { ...prev.contests };
        delete remaining[contestId];

        const nextActiveId = prev.activeContestId === contestId ? Object.keys(remaining)[0] : prev.activeContestId;

        const next: MultiContestData = {
          activeContestId: nextActiveId,
          contests: remaining
        };

        // Async remove from Firestore
        deleteDoc(doc(db, 'concursos', contestId)).catch(() => {});

        return persistMultiData(next);
      });
    },
    []
  );

  const addParticipantToContest = useCallback(
    (contestId: string, name: string, pin?: string) => {
      setMultiData((prev) => {
        const contest = prev.contests[contestId];
        if (!contest) return prev;

        const nextOrder = contest.participants.length + 1;
        const autoPin = pin && pin.trim().length === 4 ? pin.trim() : (1000 + nextOrder).toString();
        const newP: Participant = {
          id: `p_${Date.now().toString(36)}`,
          name: name.trim(),
          pin: autoPin,
          dishName: '',
          ingredients: [],
          description: '',
          tastingOrder: nextOrder
        };

        const updatedContest: ContestState = {
          ...contest,
          participants: [...contest.participants, newP],
          updatedAt: new Date().toISOString()
        };

        const next: MultiContestData = {
          ...prev,
          contests: {
            ...prev.contests,
            [contestId]: updatedContest
          }
        };

        return persistMultiData(next);
      });
    },
    []
  );

  const removeParticipantFromContest = useCallback(
    (contestId: string, participantId: string) => {
      setMultiData((prev) => {
        const contest = prev.contests[contestId];
        if (!contest) return prev;

        const filtered = contest.participants
          .filter((p) => p.id !== participantId)
          .map((p, idx) => ({ ...p, tastingOrder: idx + 1 }));

        const updatedVotes = { ...contest.votes };
        delete updatedVotes[participantId];

        const updatedContest: ContestState = {
          ...contest,
          participants: filtered,
          votes: updatedVotes,
          updatedAt: new Date().toISOString()
        };

        const next: MultiContestData = {
          ...prev,
          contests: {
            ...prev.contests,
            [contestId]: updatedContest
          }
        };

        return persistMultiData(next);
      });
    },
    []
  );

  const updateContestMeta = useCallback(
    (contestId: string, updates: { title?: string; code?: string; adminPin?: string }) => {
      setMultiData((prev) => {
        const contest = prev.contests[contestId];
        if (!contest) return prev;

        const updatedContest: ContestState = {
          ...contest,
          ...updates,
          updatedAt: new Date().toISOString()
        };

        const next: MultiContestData = {
          ...prev,
          contests: {
            ...prev.contests,
            [contestId]: updatedContest
          }
        };

        return persistMultiData(next);
      });
    },
    []
  );

  // ==========================================
  // AUTHENTICATION & ROLE DETECTION
  // ==========================================

  const loginWithCode = useCallback(
    (rawCode: string, targetContestId?: string): { success: boolean; role?: UserRole; error?: string } => {
      const code = rawCode.trim();
      if (!code) {
        return { success: false, error: 'Por favor introduce un código de acceso.' };
      }

      // Check if global TV request
      if (code.toUpperCase() === 'TV' || code.toUpperCase() === 'TELE') {
        const cid = targetContestId || multiData.activeContestId;
        const newSession: UserSession = { role: 'tv', contestId: cid };
        saveSession(newSession);
        return { success: true, role: 'tv' };
      }

      // Check if code matches Superadmin Master PIN
      // 1. Check against active / selected contest adminPin
      const chosenContest = targetContestId ? multiData.contests[targetContestId] : multiData.contests[multiData.activeContestId];
      if (chosenContest && chosenContest.adminPin === code) {
        const newSession: UserSession = { role: 'superadmin', contestId: chosenContest.id };
        saveSession(newSession);
        return { success: true, role: 'superadmin' };
      }

      // 2. Check universal default 9999 or any contest's admin pin
      if (code === '9999' || Object.values(multiData.contests).some((c) => c.adminPin === code)) {
        const cid = targetContestId || multiData.activeContestId;
        const newSession: UserSession = { role: 'superadmin', contestId: cid };
        saveSession(newSession);
        return { success: true, role: 'superadmin' };
      }

      // Check if code is a Participant PIN
      // First check within the specified / active contest
      if (chosenContest) {
        const matched = chosenContest.participants.find((p) => p.pin === code);
        if (matched) {
          const newSession: UserSession = {
            role: 'participant',
            contestId: chosenContest.id,
            participantId: matched.id
          };
          saveSession(newSession);
          return { success: true, role: 'participant' };
        }
      }

      // If not found in chosen contest, search across ALL contests
      for (const contest of Object.values(multiData.contests)) {
        const matched = contest.participants.find((p) => p.pin === code);
        if (matched) {
          const newSession: UserSession = {
            role: 'participant',
            contestId: contest.id,
            participantId: matched.id
          };
          saveSession(newSession);
          return { success: true, role: 'participant' };
        }
      }

      return {
        success: false,
        error: 'Código no reconocido. Comprueba el código o solicita ayuda al organizador.'
      };
    },
    [multiData, saveSession]
  );

  const loginAsTV = useCallback(
    (contestId?: string) => {
      const cid = contestId || multiData.activeContestId;
      const newSession: UserSession = { role: 'tv', contestId: cid };
      saveSession(newSession);
    },
    [multiData.activeContestId, saveSession]
  );

  const logout = useCallback(() => {
    saveSession(null);
  }, [saveSession]);

  // Current logged in participant (if role === 'participant')
  const currentParticipant = useMemo(() => {
    if (session?.role !== 'participant' || !session.participantId) return null;
    return currentContest.participants.find((p) => p.id === session.participantId) || null;
  }, [session, currentContest]);

  return {
    // Current contest state & actions
    state: currentContest,
    setPhase,
    updateParticipant,
    reorderTasting,
    submitVote,
    setActiveTasting,
    nextGalaStep,
    simulateSampleVotes,
    resetContest,

    // Multi-contest state & management
    multiData,
    contestsList: Object.values(multiData.contests),
    activeContestId,
    createContest,
    switchContest,
    deleteContest,
    addParticipantToContest,
    removeParticipantFromContest,
    updateContestMeta,

    // Session & Auth
    session,
    currentParticipant,
    loginWithCode,
    loginAsTV,
    logout
  };
}
