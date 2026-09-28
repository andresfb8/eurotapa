import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, onSnapshot, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  ContestState,
  Participant,
  VoteRecord,
  ContestPhase,
  UserSession,
  UserRole,
  MultiContestData,
  RemoteContestSummary
} from '../types/contest';
import { INITIAL_CONTEST_STATE } from './mockData';
import { MASTER_PIN, generateUniquePin } from '../utils/pins';

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

/**
 * A participant device only knows its own contest, so it must never overwrite the global
 * contest registry (`app_meta/registry`) with that partial list.
 */
let registryWritesEnabled = true;

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

function loadStoredSession(): UserSession | null {
  try {
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

// ==========================================
// ACCESS LINKS (?c=<contestId>&pin=<pin>)
// ==========================================

interface UrlAccessParams {
  pin: string;
  role: string | null;
  contestId: string | null;
}

const URL_ACCESS_KEYS = ['c', 'contest', 'pin', 'code', 'role'];
const MISSING_CONTEST_ERROR =
  'Este enlace no apunta a un concurso disponible. Puede que haya sido eliminado.';

function readUrlAccessParams(): UrlAccessParams | null {
  if (typeof window === 'undefined' || !window.location.search) return null;
  const params = new URLSearchParams(window.location.search);
  return {
    pin: (params.get('pin') || params.get('code') || '').trim(),
    role: params.get('role'),
    contestId: params.get('c') || params.get('contest')
  };
}

function hasUrlAccessParams(params: UrlAccessParams | null): boolean {
  return !!params && (!!params.pin || !!params.role || !!params.contestId);
}

/** Removes the access params from the address bar so the PIN is not left visible nor re-used on reload. */
function clearUrlAccessParams(): void {
  if (typeof window === 'undefined' || !window.location.search) return;
  const url = new URL(window.location.href);
  let changed = false;
  URL_ACCESS_KEYS.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });
  if (!changed) return;
  const query = url.searchParams.toString();
  window.history.replaceState({}, '', `${url.pathname}${query ? `?${query}` : ''}${url.hash}`);
}

function hadLocalMultiData(): boolean {
  try {
    return !!localStorage.getItem(MULTI_STORAGE_KEY) || !!localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return false;
  }
}

async function fetchContestFromCloud(contestId: string): Promise<ContestState | null> {
  try {
    const snapshot = await getDoc(doc(db, 'concursos', contestId));
    if (!snapshot.exists()) return null;
    const data = snapshot.data() as ContestState;
    if (!data || !data.id || !Array.isArray(data.participants)) return null;
    return data;
  } catch (e) {
    console.warn('No se pudo cargar el concurso desde Firestore:', e);
    return null;
  }
}

interface BootstrapResult {
  multi: MultiContestData;
  session: UserSession | null;
  error: string | null;
  injectedContest: boolean;
}

async function resolveAccessFromUrl(
  params: UrlAccessParams,
  base: MultiContestData,
  storedSession: UserSession | null
): Promise<BootstrapResult> {
  let multi = base;
  let injectedContest = false;
  const requestedId = params.contestId;
  let contest = requestedId ? base.contests[requestedId] : undefined;
  let requestedContestMissing = false;

  if (requestedId && !contest) {
    const fromCloud = await fetchContestFromCloud(requestedId);
    if (fromCloud) {
      contest = fromCloud;
      multi = {
        activeContestId: fromCloud.id,
        contests: hadLocalMultiData()
          ? { ...base.contests, [fromCloud.id]: fromCloud }
          : { [fromCloud.id]: fromCloud }
      };
      injectedContest = true;
    } else {
      requestedContestMissing = true;
    }
  } else if (requestedId && contest) {
    multi = { ...base, activeContestId: contest.id };
  }

  if (params.role === 'tv') {
    return {
      multi,
      session: { role: 'tv', contestId: contest?.id || multi.activeContestId },
      error: requestedContestMissing ? MISSING_CONTEST_ERROR : null,
      injectedContest
    };
  }

  if (!params.pin) {
    return {
      multi,
      session: storedSession,
      error: requestedContestMissing ? MISSING_CONTEST_ERROR : null,
      injectedContest
    };
  }

  if (params.pin === MASTER_PIN) {
    return {
      multi,
      session: { role: 'superadmin', contestId: contest?.id || multi.activeContestId },
      error: null,
      injectedContest
    };
  }

  if (contest) {
    const matched = contest.participants.find((p) => p.pin === params.pin);
    if (matched) {
      return {
        multi,
        session: { role: 'participant', contestId: contest.id, participantId: matched.id },
        error: null,
        injectedContest
      };
    }
    return {
      multi,
      session: null,
      error: `El PIN ${params.pin} no pertenece a "${contest.title}". Pide a la organización que te reenvíe tu enlace.`,
      injectedContest
    };
  }

  const matches = Object.values(multi.contests).flatMap((c) => {
    const participant = c.participants.find((p) => p.pin === params.pin);
    return participant ? [{ contest: c, participant }] : [];
  });

  if (matches.length === 1) {
    const match = matches[0];
    return {
      multi,
      session: { role: 'participant', contestId: match.contest.id, participantId: match.participant.id },
      error: null,
      injectedContest
    };
  }

  if (matches.length > 1) {
    return {
      multi,
      session: null,
      error: 'Ese PIN existe en varios concursos. Elige tu concurso en la lista y vuelve a intentarlo.',
      injectedContest
    };
  }

  return {
    multi,
    session: null,
    error: requestedContestMissing
      ? MISSING_CONTEST_ERROR
      : 'Código no reconocido. Comprueba el código o solicita ayuda al organizador.',
    injectedContest
  };
}

// Access params are read and consumed once, before React mounts, so the deep link
// survives StrictMode's double effect invocation and the PIN leaves the address bar.
const initialUrlAccessParams = readUrlAccessParams();
const initialBootstrapRequested = hasUrlAccessParams(initialUrlAccessParams);
if (initialBootstrapRequested) {
  clearUrlAccessParams();
}
const initialBootstrapPromise: Promise<BootstrapResult> | null = initialBootstrapRequested
  ? resolveAccessFromUrl(
      initialUrlAccessParams as UrlAccessParams,
      loadInitialMultiData(),
      loadStoredSession()
    )
  : null;

/** Local-only cache (localStorage + cross-tab broadcast). */
function cacheMultiLocal(data: MultiContestData): MultiContestData {
  try {
    localStorage.setItem(MULTI_STORAGE_KEY, JSON.stringify(data));
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'MULTI_UPDATE', data });
    }
  } catch (e) {
    console.warn('Error caching multi data:', e);
  }
  return data;
}

function syncMultiToCloud(data: MultiContestData): void {
  try {
    // Async sync active contest to Firestore
    const active = data.contests[data.activeContestId];
    if (active) {
      const docRef = doc(db, 'concursos', active.id);
      setDoc(docRef, active, { merge: true }).catch((err) => {
        console.warn('Firestore active contest sync warning:', err);
      });
    }

    // Also persist registry list (organiser devices only)
    if (registryWritesEnabled) {
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
    }
  } catch (e) {
    console.warn('Error syncing multi data to Firestore:', e);
  }
}

function persistMultiData(data: MultiContestData): MultiContestData {
  cacheMultiLocal(data);
  syncMultiToCloud(data);
  return data;
}

export function useContest() {
  const [multiData, setMultiData] = useState<MultiContestData>(loadInitialMultiData);
  const [session, setSession] = useState<UserSession | null>(loadStoredSession);
  const [remoteContests, setRemoteContests] = useState<RemoteContestSummary[]>([]);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [booting, setBooting] = useState<boolean>(() => !!initialBootstrapPromise);

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

  // 0. Deep link bootstrap: resolve the contest and the session carried by the access URL
  useEffect(() => {
    if (!initialBootstrapPromise) return;
    let cancelled = false;

    initialBootstrapPromise
      .then((result) => {
        if (cancelled) return;
        setMultiData(result.multi);
        if (result.injectedContest) {
          cacheMultiLocal(result.multi);
        }
        if (result.session) {
          saveSession(result.session);
        }
        setBootstrapError(result.error);
        setBooting(false);
      })
      .catch((error) => {
        console.warn('Error resolviendo el enlace de acceso:', error);
        if (cancelled) return;
        setBootstrapError('No se pudo abrir el enlace de acceso. Comprueba tu conexión e inténtalo de nuevo.');
        setBooting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [saveSession]);

  // 0b. Contest registry: lets a fresh device list contests that are not cached locally yet
  useEffect(() => {
    if (session) return;
    let cancelled = false;

    (async () => {
      try {
        const snapshot = await getDoc(doc(db, 'app_meta', 'registry'));
        if (cancelled || !snapshot.exists()) return;
        const data = snapshot.data() as { contests?: RemoteContestSummary[] };
        if (Array.isArray(data.contests)) {
          setRemoteContests(data.contests);
        }
      } catch (error) {
        console.warn('No se pudo leer el registro de concursos:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  // 0c. Only organiser devices may rewrite the global contest registry
  useEffect(() => {
    registryWritesEnabled = session?.role !== 'participant';
  }, [session]);

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
      adminPin: string = MASTER_PIN,
      initialParticipants: { name: string; pin: string }[] = []
    ) => {
      const contestId = 'contest_' + Date.now().toString(36);
      const cleanCode = (code || title.substring(0, 4).toUpperCase() + Math.floor(10 + Math.random() * 90)).trim().toUpperCase();

      const participants: Participant[] = [];
      initialParticipants.forEach((p, idx) => {
        participants.push({
          id: `p_${idx + 1}_${Date.now().toString(36)}`,
          name: p.name,
          pin: generateUniquePin(participants, p.pin),
          dishName: '',
          ingredients: [],
          description: '',
          tastingOrder: idx + 1
        });
      });

      if (participants.length === 0) {
        ['Participante 1', 'Participante 2', 'Participante 3'].forEach((name, idx) => {
          participants.push({
            id: `p_${idx + 1}`,
            name,
            pin: generateUniquePin(participants),
            dishName: '',
            ingredients: [],
            description: '',
            tastingOrder: idx + 1
          });
        });
      }

      const newContest: ContestState = {
        id: contestId,
        title: title.trim() || 'Nuevo Concurso de Tapas',
        code: cleanCode,
        phase: 'CONFIGURACION',
        adminPin: adminPin.trim() || MASTER_PIN,
        participants,
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
        const autoPin = generateUniquePin(contest.participants, pin);
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
    async (rawCode: string, targetContestId?: string): Promise<{ success: boolean; role?: UserRole; error?: string }> => {
      const code = rawCode.trim();
      if (!code) {
        return { success: false, error: 'Por favor introduce un código de acceso.' };
      }

      const effectiveContestId = targetContestId || multiData.activeContestId;

      // Check if global TV request
      if (code.toUpperCase() === 'TV' || code.toUpperCase() === 'TELE') {
        const newSession: UserSession = { role: 'tv', contestId: effectiveContestId };
        saveSession(newSession);
        return { success: true, role: 'tv' };
      }

      // Load the selected contest on demand (fresh device, contest not cached yet)
      let chosenContest = targetContestId ? multiData.contests[targetContestId] : undefined;
      if (!chosenContest && targetContestId) {
        chosenContest = (await fetchContestFromCloud(targetContestId)) || undefined;
        if (chosenContest) {
          const fetched = chosenContest;
          setMultiData((prev) =>
            cacheMultiLocal({
              ...prev,
              contests: { ...prev.contests, [fetched.id]: fetched }
            })
          );
        }
      }

      if (targetContestId && !chosenContest) {
        return {
          success: false,
          error: 'No hemos podido cargar ese concurso. Comprueba tu conexión e inténtalo de nuevo.'
        };
      }

      if (!chosenContest) {
        chosenContest = multiData.contests[multiData.activeContestId];
      }

      // Check if code is a Participant PIN (participants take priority so an admin PIN can never leak access to them)
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

      // Superadmin: universal master PIN or the admin PIN of the selected contest only
      if (code === MASTER_PIN || (chosenContest && chosenContest.adminPin === code)) {
        const newSession: UserSession = { role: 'superadmin', contestId: chosenContest?.id || effectiveContestId };
        saveSession(newSession);
        return { success: true, role: 'superadmin' };
      }

      if (targetContestId) {
        // The contest was selected explicitly (link or picker): never fall back to another contest.
        return {
          success: false,
          error: 'Ese PIN no pertenece al concurso seleccionado. Comprueba el código o elige otro concurso.'
        };
      }

      // No contest context: search the cached contests, detecting ambiguous PINs
      const matches = Object.values(multiData.contests).flatMap((c) => {
        const participant = c.participants.find((p) => p.pin === code);
        return participant ? [{ contest: c, participant }] : [];
      });

      if (matches.length === 1) {
        const match = matches[0];
        const newSession: UserSession = {
          role: 'participant',
          contestId: match.contest.id,
          participantId: match.participant.id
        };
        saveSession(newSession);
        return { success: true, role: 'participant' };
      }

      if (matches.length > 1) {
        return {
          success: false,
          error: 'Ese PIN existe en varios concursos. Elige tu concurso en la lista y vuelve a intentarlo.'
        };
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
    logout,

    // Access link bootstrap
    booting,
    bootstrapError,
    remoteContests
  };
}
