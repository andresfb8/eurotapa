import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  deleteField,
  collection,
  runTransaction,
  FieldValue
} from 'firebase/firestore';
import { db } from './firebase';
import { getCloudStatus, reportCloudFailure, reportCloudSuccess, subscribeCloudStatus } from './cloudStatus';
import {
  ContestState,
  GalaState,
  Member,
  Team,
  VoteRecord,
  ContestPhase,
  GalaMode,
  UserSession,
  UserRole,
  MultiContestData,
  RemoteContestSummary,
  TvTheme,
  VoteModeSetting
} from '../types/contest';
import { INITIAL_CONTEST_STATE } from './mockData';
import { MASTER_PIN, generateUniquePin } from '../utils/pins';
import { normalizeContest } from '../utils/contestMigration';
import { buildJuryVotes, effectiveVoteMode } from '../utils/juries';
import { shuffled } from '../utils/draw';

/**
 * Sandbox (`npm run dev:sandbox`): the demo contest lives only in this browser and nothing is read
 * from or written to Firestore, so every phase can be tried without touching real contests.
 */
export const IS_SANDBOX = import.meta.env.VITE_LOCAL_ONLY === '1';
const STORAGE_PREFIX = IS_SANDBOX ? 'eurotapa_sandbox' : 'eurotapa';

const MULTI_STORAGE_KEY = `${STORAGE_PREFIX}_multicontest_v2`;
const LEGACY_STORAGE_KEY = `${STORAGE_PREFIX}_state_v1`;
const SESSION_STORAGE_KEY = `${STORAGE_PREFIX}_session_v2`;
const SYNC_CHANNEL = `${STORAGE_PREFIX}_live_sync_v2`;

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(SYNC_CHANNEL);
  }
} catch {
  // Graceful fallback
}

/**
 * A participant device only knows its own contest, so it must never rewrite the global contest
 * registry (`app_meta/registry`), nor the shared contest document: a stale copy of it would send
 * the phase, the draw or the roster back in time for everybody.
 */
let deviceRole: UserRole | null = null;

function loadInitialMultiData(): MultiContestData {
  try {
    const raw = localStorage.getItem(MULTI_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { activeContestId?: string; contests?: Record<string, unknown> };
      const contests: Record<string, ContestState> = {};
      if (parsed && parsed.contests) {
        Object.values(parsed.contests).forEach((candidate) => {
          const normalized = normalizeContest(candidate);
          if (normalized) contests[normalized.id] = normalized;
        });
      }
      const ids = Object.keys(contests);
      if (ids.length > 0) {
        const activeContestId =
          parsed.activeContestId && contests[parsed.activeContestId] ? parsed.activeContestId : ids[0];
        return { activeContestId, contests };
      }
    }

    // Check for legacy migration (single contest)
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const normalized = normalizeContest(JSON.parse(legacyRaw));
      if (normalized) {
        return { activeContestId: normalized.id, contests: { [normalized.id]: normalized } };
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

/** Only the organizer's device owns the shared document; a phone only writes its own data. */
deviceRole = loadStoredSession()?.role ?? null;

// ==========================================
// ACCESS LINKS (?c=<contestId> and role=tv)
// ==========================================

interface UrlAccessParams {
  role: string | null;
  contestId: string | null;
}

const URL_ACCESS_KEYS = ['c', 'contest', 'pin', 'code', 'role'];
const MISSING_CONTEST_ERROR =
  'Este enlace no apunta a un concurso disponible. Puede que haya sido eliminado.';

function readUrlAccessParams(): UrlAccessParams | null {
  if (typeof window === 'undefined' || !window.location.search) return null;
  const params = new URLSearchParams(window.location.search);
  // `pin` / `code` belong to old links: they are never used to enter, only cleaned from the URL.
  if (!URL_ACCESS_KEYS.some((key) => params.has(key))) return null;
  return {
    role: params.get('role'),
    contestId: params.get('c') || params.get('contest')
  };
}

function hasUrlAccessParams(params: UrlAccessParams | null): boolean {
  return !!params && (!!params.role || !!params.contestId);
}

/** Removes the access params from the address bar so they are not left visible nor re-used on reload. */
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
  if (IS_SANDBOX) return null;
  try {
    const snapshot = await getDoc(doc(db, 'concursos', contestId));
    if (!snapshot.exists()) return null;
    return normalizeContest(snapshot.data());
  } catch (e) {
    console.warn('No se pudo cargar el concurso desde Firestore:', e);
    return null;
  }
}

/** Contests an organizer PIN opens: the one it was typed for plus any other sharing that same PIN. */
function adminContestIdsFor(multi: MultiContestData, pin: string, contestId: string): string[] {
  const ids = Object.values(multi.contests)
    .filter((c) => c.adminPin === pin)
    .map((c) => c.id);
  return ids.includes(contestId) ? ids : [contestId, ...ids];
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

  // The link only chooses the contest: entering always needs the code that travels in the
  // WhatsApp message. Whatever session was already open on this device stays as it is.
  return {
    multi,
    session: storedSession,
    error: requestedContestMissing ? MISSING_CONTEST_ERROR : null,
    injectedContest
  };
}

// Access params are read and consumed once, before React mounts, so the deep link
// survives StrictMode's double effect invocation and the PIN leaves the address bar.
const initialUrlAccessParams = readUrlAccessParams();
const initialBootstrapRequested = hasUrlAccessParams(initialUrlAccessParams);
if (initialUrlAccessParams) {
  // Even an old link with a `pin` gets it removed from the address bar
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

/**
 * A fresh gala state. The reveal index belongs to one specific list of juries, so every time the
 * gala starts again (new contest, new votes, re-entry after the podium) it must begin from zero.
 */
function emptyGala(): GalaState {
  return {
    currentVoterIndex: 0,
    step: 'ESPERANDO',
    revealedTapaIds: [],
    lastBatchIds: [],
    history: []
  };
}

/**
 * Firestore does not accept nested arrays ("Nested arrays are not supported"), and the gala history
 * is a list of clicks, each one holding the tapas revealed in that click. It travels as `"a|b"`
 * strings and `normalizeGala()` splits it again when the document comes back.
 */
type CloudGala = Omit<GalaState, 'history'> & { history?: string[] };

function serializeGala(gala: GalaState): CloudGala {
  return {
    ...gala,
    history: (gala.history ?? []).map((batch) => batch.join('|'))
  };
}

function contestRef(contestId: string) {
  return doc(db, 'concursos', contestId);
}

/**
 * Drops every `undefined` property, recursively. Normalized contests describe their optional fields
 * as `undefined`, and Firestore refuses to write a document that contains one of them
 * ("Unsupported field value: undefined"), which used to make the whole sync fail in silence.
 * `FieldValue` sentinels (`deleteField()`) are values, not documents: they must be kept as they are.
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)) as unknown as T;
  if (value && typeof value === 'object' && !(value instanceof FieldValue)) {
    const clean: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      if (entry !== undefined) clean[key] = stripUndefined(entry);
    });
    return clean as T;
  }
  return value;
}

/**
 * Votes are written one field at a time (`votes.<memberId>`). A full-document write merges nested
 * maps, so a stale copy of the whole `votes` map can never delete a vote: it only rewrites the
 * entries it carries. Deleting one vote therefore needs its own `deleteField()` write.
 */
function writeVoteToCloud(contestId: string, vote: VoteRecord): void {
  if (IS_SANDBOX) return;
  // `updateDoc` treats the dotted key as a field path and replaces that whole vote object, so a
  // re-vote cannot leave scores from the previous ballot behind. Other members' votes are untouched.
  updateDoc(contestRef(contestId), {
    [`votes.${vote.voterId}`]: vote,
    updatedAt: new Date().toISOString()
  })
    .then(() => reportCloudSuccess('voto'))
    .catch((err) => reportCloudFailure('No se pudo guardar tu voto en la nube', err));
}

/** Removes a single sealed vote, which is what "reabrir voto" needs to do in Firestore. */
function deleteVoteInCloud(contestId: string, memberId: string): void {
  if (IS_SANDBOX) return;
  updateDoc(contestRef(contestId), {
    [`votes.${memberId}`]: deleteField(),
    updatedAt: new Date().toISOString()
  })
    .then(() => reportCloudSuccess('voto'))
    .catch((err) => reportCloudFailure('No se pudo reabrir el voto en la nube', err));
}

/**
 * Replaces the whole vote map (reset, simulation or removing a team). `mergeFields: ['votes']`
 * patches that one field as a unit, so it replaces the map instead of merging member by member;
 * and unlike `updateDoc`, it also creates the document if a brand-new contest has not synced yet.
 */
function replaceVotesInCloud(contestId: string, votes: Record<string, VoteRecord>): void {
  if (IS_SANDBOX) return;
  setDoc(
    contestRef(contestId),
    { votes, updatedAt: new Date().toISOString() },
    { mergeFields: ['votes', 'updatedAt'] }
  )
    .then(() => reportCloudSuccess('voto'))
    .catch((err) => reportCloudFailure('No se pudo actualizar la votación en la nube', err));
}

/**
 * The ficha is part of the `teams` array, and Firestore cannot address an array element by index:
 * a dotted path such as `teams.0.dishName` is read as map keys and turns the whole array into a
 * map, dropping every other team (that is exactly what happened once). It has to be read, patched
 * and written back inside a transaction, finding the team by its id.
 *
 * Several people cook the same tapa and any of them can complete the ficha, so the write is merged
 * field by field: only what this person actually changed is applied. If one writes the description
 * while the other uploads the photo, neither erases the other's work.
 */
async function saveTeamFichaToCloud(
  contestId: string,
  team: Team,
  baseline?: Team,
  editorName?: string
): Promise<void> {
  if (IS_SANDBOX) return;
  const ref = contestRef(contestId);
  const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const touched = (field: keyof Team) => !baseline || !sameValue(team[field], baseline[field]);
  const fichaFields: (keyof Team)[] = ['dishName', 'ingredients', 'description', 'photoUrl'];
  const changedAny = !baseline || fichaFields.some((field) => touched(field));
  if (!changedAny) return;

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.data() as Partial<ContestState> | undefined;
      const teams = Array.isArray(current?.teams) ? (current.teams as Team[]) : [];
      if (!teams.some((candidate) => candidate.id === team.id)) return;

      const nextTeams = teams.map((candidate) => {
        if (candidate.id !== team.id) return candidate;
        const merged: Team = { ...candidate };
        if (touched('dishName')) merged.dishName = team.dishName;
        if (touched('ingredients')) merged.ingredients = team.ingredients;
        if (touched('description')) merged.description = team.description;
        if (touched('photoUrl')) merged.photoUrl = team.photoUrl ?? '';
        merged.lastEditedBy = editorName ?? candidate.lastEditedBy;
        merged.lastEditedAt = new Date().toISOString();
        return merged;
      });
      transaction.update(ref, { teams: nextTeams, updatedAt: new Date().toISOString() });
    });
    reportCloudSuccess('ficha');
  } catch (err) {
    reportCloudFailure('No se pudo guardar la ficha en la nube', err);
  }
}

/**
 * A photo is a data URL of ~100-200 KB, and a Firestore document cannot exceed 1 MiB: nine photos
 * inside the contest document would break every write. Each photo lives in its own document.
 */
function writeTeamPhotoToCloud(contestId: string, teamId: string, photoUrl: string): void {
  if (IS_SANDBOX) return;
  setDoc(doc(db, 'concursos', contestId, 'fotos', teamId), {
    photoUrl,
    updatedAt: new Date().toISOString()
  })
    .then(() => reportCloudSuccess('foto'))
    .catch((err) => reportCloudFailure('No se pudo guardar la fotografía en la nube', err));
}

/** Random vote used by the test simulation: same N-1 … 1 ballot a member would send. */
function buildSampleVotes(contest: ContestState): Record<string, VoteRecord> {
  const generatedVotes: Record<string, VoteRecord> = {};

  contest.members.forEach((voter) => {
    const rivals = contest.teams.filter((team) => team.id !== voter.teamId);
    const scores: Record<string, number> = {};
    // Same ballot the phone builds: the first rival gets (number of rivals) points, the last 1
    shuffled(rivals.map((team) => team.id)).forEach((teamId, index) => {
      scores[teamId] = rivals.length - index;
    });
    generatedVotes[voter.id] = {
      voterId: voter.id,
      voterName: voter.name,
      scores,
      submittedAt: new Date().toISOString()
    };
  });

  return generatedVotes;
}

function syncMultiToCloud(data: MultiContestData): void {
  if (IS_SANDBOX) return;
  // Only the organizer's device may rewrite the shared contest document and the global registry:
  // a phone carries a partial, possibly stale copy of the contest.
  if (deviceRole !== 'superadmin') return;

  try {
    // Async sync active contest to Firestore
    const active = data.contests[data.activeContestId];
    if (active) {
      const docRef = contestRef(active.id);
      // Votes are written on their own (see writeVoteToCloud): sending them here would let a stale
      // local copy overwrite a vote that another phone has just sealed.
      const contestWithoutVotes: Partial<ContestState> = { ...active };
      delete contestWithoutVotes.votes;
      // `participants` is the legacy field kept by old documents: remove it so only teams/members remain.
      const payload = stripUndefined({
        ...contestWithoutVotes,
        // `history` is a list of lists: Firestore refuses nested arrays, so it travels flattened
        gala: serializeGala(active.gala),
        participants: deleteField()
      }) as unknown as ContestState;
      setDoc(docRef, payload, { merge: true })
        .then(() => reportCloudSuccess('concurso'))
        .catch((err) =>
          reportCloudFailure('Los cambios del concurso no están llegando a la nube', err)
        );
    }

    // Also persist registry list
    const registryRef = doc(db, 'app_meta', 'registry');
    const contestSummaries = Object.values(data.contests).map((c) => ({
      id: c.id,
      title: c.title,
      code: c.code || '',
      phase: c.phase,
      participantsCount: c.members.length,
      updatedAt: c.updatedAt
    }));
    setDoc(registryRef, { contests: contestSummaries, activeContestId: data.activeContestId }, { merge: true })
      .then(() => reportCloudSuccess('registro'))
      .catch((err) => reportCloudFailure('No se pudo actualizar la lista de concursos', err));
  } catch (e) {
    reportCloudFailure('Los cambios del concurso no están llegando a la nube', e);
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
  const [cloudStatus, setCloudStatus] = useState(getCloudStatus);
  /** Photos live outside the contest document (one per team) so it never reaches the 1 MiB limit. */
  const [photos, setPhotos] = useState<Record<string, string>>({});

  // Surface cloud write failures instead of letting them pass unnoticed
  useEffect(() => subscribeCloudStatus(setCloudStatus), []);

  // Active contest is either from session contestId or activeContestId
  const activeContestId = session?.contestId || multiData.activeContestId;
  const currentContest = multiData.contests[activeContestId] || multiData.contests[multiData.activeContestId] || INITIAL_CONTEST_STATE;

  // What the screens render: the contest plus the photos that live in their own documents
  const displayContest = useMemo(() => {
    if (Object.keys(photos).length === 0) return currentContest;
    return {
      ...currentContest,
      teams: currentContest.teams.map((team) =>
        photos[team.id] ? { ...team, photoUrl: photos[team.id] } : team
      )
    };
  }, [currentContest, photos]);

  // Persist session changes
  const saveSession = useCallback((newSession: UserSession | null) => {
    setSession(newSession);
    // What this device is allowed to write to the cloud depends on the role it is using
    deviceRole = newSession?.role ?? null;
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

  // 0. Deep link bootstrap: chooses the contest carried by the URL. The link never logs anybody
  //    in: entering always needs the code that arrives in the private WhatsApp message.
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
    if (session || IS_SANDBOX) return;
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

  // Listeners: Firestore & Cross-Tab Broadcast & Window Storage
  useEffect(() => {
    // 1. Firebase Firestore Live Listener for current contest
    let unsubscribeFirestore = () => {};
    try {
      if (IS_SANDBOX) throw new Error('Sandbox: Firestore desactivado');
      const docRef = doc(db, 'concursos', activeContestId);
      unsubscribeFirestore = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const cloudContest = normalizeContest(snapshot.data());
            if (cloudContest) {
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

  // Photos of the fichas: one document per team, read live so the TV and the gala see them.
  useEffect(() => {
    if (IS_SANDBOX) {
      setPhotos({});
      return;
    }
    let unsubscribePhotos = () => {};
    try {
      unsubscribePhotos = onSnapshot(
        collection(db, 'concursos', activeContestId, 'fotos'),
        (snapshot) => {
          const next: Record<string, string> = {};
          snapshot.forEach((photoDoc) => {
            const data = photoDoc.data();
            if (typeof data.photoUrl === 'string' && data.photoUrl) {
              next[photoDoc.id] = data.photoUrl;
            }
          });
          setPhotos(next);
        },
        (error) => {
          console.warn('No se pudieron leer las fotografías de las fichas:', error);
        }
      );
    } catch (error) {
      console.warn('Photo subscription error:', error);
    }
    return () => unsubscribePhotos();
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
          // Keep the edited contest as the one that gets synced, even if the cached active id had
          // drifted from the session (a fresh device opening an access link).
          activeContestId,
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
      updateCurrentContest((prev) => {
        // The way votes count has to be the same while ballots are cast and while the gala reveals
        // them. `auto` is resolved with the first sealed ballot (see submitVote) and, as a last
        // resort, when the gala starts, instead of drifting with later team changes.
        const tallyLock =
          phase === 'GALA_TV'
            ? {
                voteMode:
                  prev.voteMode && prev.voteMode !== 'auto'
                    ? prev.voteMode
                    : effectiveVoteMode(prev.teams, prev.members, prev.voteMode)
              }
            : {};

        // Every entry into the gala starts a new reveal: the previous index and the revealed ids
        // belong to an older list of juries (votes may even have been reopened in between).
        const galaReset = phase === 'GALA_TV' && prev.phase !== 'GALA_TV' ? { gala: emptyGala() } : {};

        // Starting the tasting always opens with the first turn of the official order
        if (phase === 'DEGUSTACION' && (prev.phase === 'CONFIGURACION' || prev.phase === 'SORTEO')) {
          const first = [...prev.teams].sort((a, b) => a.tastingOrder - b.tastingOrder)[0];
          return {
            ...prev,
            phase,
            ...tallyLock,
            tastingServedUpTo: first?.tastingOrder ?? 0,
            ...(first ? { activeTastingId: first.id } : {})
          };
        }
        return { ...prev, phase, ...tallyLock, ...galaReset };
      });
    },
    [updateCurrentContest]
  );

  /**
   * Updates the ficha (dish data) of a team. Any of its members can edit it: `baseline` is the
   * ficha as it was when this person opened it, so only their own changes are written and they
   * cannot overwrite what their teammate has just added.
   */
  const updateTeam = useCallback(
    (updatedTeam: Team, baseline?: Team) => {
      const editorName =
        session?.role === 'participant'
          ? currentContest.members.find((member) => member.id === session.participantId)?.name
          : undefined;
      const photoChanged = !baseline || updatedTeam.photoUrl !== baseline.photoUrl;
      const inlinePhoto =
        photoChanged && updatedTeam.photoUrl?.startsWith('data:') ? updatedTeam.photoUrl : null;
      // The photo never travels inside the contest document: it goes to its own document
      const storedTeam: Team = updatedTeam.photoUrl?.startsWith('data:')
        ? { ...updatedTeam, photoUrl: '' }
        : updatedTeam;

      if (inlinePhoto) {
        // Show it at once, without waiting for the photo document to come back
        setPhotos((prev) => ({ ...prev, [updatedTeam.id]: inlinePhoto }));
        writeTeamPhotoToCloud(activeContestId, updatedTeam.id, inlinePhoto);
      }

      updateCurrentContest((prev) => ({
        ...prev,
        teams: prev.teams.map((team) => (team.id === storedTeam.id ? storedTeam : team))
      }));

      // The shared array is patched in a transaction: a phone only owns this ficha, not the
      // phase, the draw or the rest of the teams.
      void saveTeamFichaToCloud(activeContestId, storedTeam, baseline, editorName);
    },
    [activeContestId, currentContest, session, updateCurrentContest]
  );

  const updateMemberPin = useCallback(
    (memberId: string, pin: string) => {
      updateCurrentContest((prev) => ({
        ...prev,
        members: prev.members.map((member) => (member.id === memberId ? { ...member, pin } : member))
      }));
    },
    [updateCurrentContest]
  );

  const regenerateMemberPin = useCallback(
    (memberId: string) => {
      updateCurrentContest((prev) => {
        const member = prev.members.find((m) => m.id === memberId);
        if (!member) return prev;
        // The organizer PIN counts as taken, so a member can never end up sharing it
        const pin = generateUniquePin([...prev.members, { id: '__admin', pin: prev.adminPin }]);
        return {
          ...prev,
          members: prev.members.map((m) => (m.id === memberId ? { ...m, pin } : m))
        };
      });
    },
    [updateCurrentContest]
  );

  const reorderTasting = useCallback(
    (orderedIds: string[]) => {
      updateCurrentContest((prev) => {
        // Serving times belong to the turn, not to the team: they stay in place when teams swap turns
        const timesByTurn = [...prev.teams]
          .sort((a, b) => a.tastingOrder - b.tastingOrder)
          .map((team) => team.tastingTime);

        const updatedTeams = prev.teams.map((team) => {
          const orderIndex = orderedIds.indexOf(team.id);
          if (orderIndex === -1) return team;
          const tastingTime = timesByTurn[orderIndex];
          return {
            ...team,
            tastingOrder: orderIndex + 1,
            ...(tastingTime ? { tastingTime } : {})
          };
        });
        return { ...prev, teams: updatedTeams };
      });
    },
    [updateCurrentContest]
  );

  /** Marks the current serving order as the official one (after the random draw or a manual order). */
  const confirmDraw = useCallback(() => {
    updateCurrentContest((prev) => ({ ...prev, drawDoneAt: new Date().toISOString() }));
  }, [updateCurrentContest]);

  const submitVote = useCallback(
    (vote: VoteRecord) => {
      // Voting closes when the gala starts: do not even write the field
      if (currentContest.phase !== 'VOTACION') return;

      updateCurrentContest((prev) => {
        if (prev.phase !== 'VOTACION') return prev;
        return {
          ...prev,
          // The first ballot fixes how every ballot counts, so the gala and the phones cannot
          // disagree later because a team was added or removed in between.
          voteMode:
            prev.voteMode && prev.voteMode !== 'auto'
              ? prev.voteMode
              : effectiveVoteMode(prev.teams, prev.members, prev.voteMode),
          votes: {
            ...prev.votes,
            [vote.voterId]: vote
          }
        };
      });

      // One field, so a vote cast on another phone at the same time is never overwritten
      writeVoteToCloud(activeContestId, vote);
    },
    [activeContestId, currentContest.phase, updateCurrentContest]
  );

  /** Reopens a sealed vote so that member can vote again (e.g. they made a mistake). */
  const removeVote = useCallback(
    (memberId: string) => {
      // With the gala already running, deleting a vote would shrink the jury list under the
      // reveal index. Reopening is only allowed while the ballot is open.
      if (currentContest.phase !== 'VOTACION') return;
      if (!currentContest.votes[memberId]) return;

      updateCurrentContest((prev) => {
        if (prev.phase !== 'VOTACION' || !prev.votes[memberId]) return prev;
        const votes = { ...prev.votes };
        delete votes[memberId];
        return { ...prev, votes };
      });

      // A plain map write with `merge` would keep the old field alive: delete it explicitly
      deleteVoteInCloud(activeContestId, memberId);
    },
    [activeContestId, currentContest.phase, currentContest.votes, updateCurrentContest]
  );

  const setActiveTasting = useCallback(
    (teamId: string) => {
      updateCurrentContest((prev) => {
        const order = prev.teams.find((team) => team.id === teamId)?.tastingOrder ?? 0;
        return {
          ...prev,
          activeTastingId: teamId,
          tastingServedUpTo: Math.max(prev.tastingServedUpTo ?? 0, order)
        };
      });
    },
    [updateCurrentContest]
  );

  const setVoteMode = useCallback(
    (voteMode: VoteModeSetting) => {
      updateCurrentContest((prev) => {
        // Once a single ballot is sealed, changing how votes are counted would alter the result
        // mid-contest. The organizer must reset the votes first.
        if (Object.keys(prev.votes).length > 0) return prev;
        return { ...prev, voteMode };
      });
    },
    [updateCurrentContest]
  );

  const setTvTheme = useCallback(
    (tvTheme: TvTheme) => {
      updateCurrentContest((prev) => ({ ...prev, tvTheme }));
    },
    [updateCurrentContest]
  );

  const setGalaMode = useCallback(
    (mode: GalaMode) => {
      updateCurrentContest((prev) => ({ ...prev, galaMode: mode }));
    },
    [updateCurrentContest]
  );

  /**
   * Reveals the next gala step for the current voter according to the contest's gala mode:
   * CLASICA reveals every point one by one; DRAMATICA / MAXIMA first deliver all low points in a
   * single bulk click and then the top 3 / the maximum; DIRECTA delivers the whole vote at once.
   */
  const nextGalaStep = useCallback(() => {
    updateCurrentContest((prev) => {
      // One jury per tapa: the combined vote of the members of each team
      const votersList = buildJuryVotes(
        prev.teams,
        prev.members,
        prev.votes,
        effectiveVoteMode(prev.teams, prev.members, prev.voteMode)
      );
      if (votersList.length === 0) return prev;

      const currentIdx = prev.gala.currentVoterIndex;
      const voteRecord = votersList[currentIdx];
      if (!voteRecord) {
        return { ...prev, phase: 'PODIO' };
      }

      const sortedEntriesAscending = Object.entries(voteRecord.scores).sort((a, b) => a[1] - b[1]);
      const pending = sortedEntriesAscending.filter(
        ([tapaId]) => !prev.gala.revealedTapaIds.includes(tapaId)
      );

      if (pending.length === 0) {
        const nextIdx = currentIdx + 1;
        if (nextIdx >= votersList.length) {
          return {
            ...prev,
            phase: 'PODIO',
            gala: {
              ...prev.gala,
              currentVoterIndex: nextIdx,
              step: 'COMPLETO',
              revealedTapaIds: [],
              lastAwardedTapaId: undefined,
              lastAwardedPoints: undefined,
              lastBatchIds: [],
              history: []
            }
          };
        }
        return {
          ...prev,
          gala: {
            currentVoterIndex: nextIdx,
            step: 'ESPERANDO',
            revealedTapaIds: [],
            lastAwardedTapaId: undefined,
            lastAwardedPoints: undefined,
            lastBatchIds: [],
            history: []
          }
        };
      }

      const mode = prev.galaMode ?? 'CLASICA';
      const dramaticCount =
        mode === 'CLASICA'
          ? pending.length
          : mode === 'DIRECTA'
          ? 0
          : Math.min(mode === 'MAXIMA' ? 1 : 3, pending.length);
      const bulkCount = pending.length - dramaticCount;
      const history = prev.gala.history ?? [];

      if (bulkCount > 0) {
        const batch = pending.slice(0, bulkCount);
        const batchIds = batch.map(([tapaId]) => tapaId);
        const lastEntry = batch[batch.length - 1];
        return {
          ...prev,
          gala: {
            ...prev.gala,
            step: 'REVELANDO_PUNTOS',
            revealedTapaIds: [...prev.gala.revealedTapaIds, ...batchIds],
            history: [...history, batchIds],
            lastAwardedTapaId: lastEntry[0],
            lastAwardedPoints: lastEntry[1],
            lastBatchIds: batchIds
          }
        };
      }

      const [tapaId, points] = pending[0];
      return {
        ...prev,
        gala: {
          ...prev.gala,
          step: 'REVELANDO_PUNTOS',
          revealedTapaIds: [...prev.gala.revealedTapaIds, tapaId],
          history: [...history, [tapaId]],
          lastAwardedTapaId: tapaId,
          lastAwardedPoints: points,
          lastBatchIds: []
        }
      };
    });
  }, [updateCurrentContest]);

  /**
   * Undoes the last reveal click. If the current voter has nothing revealed yet, it goes back to
   * the previous voter with their points fully revealed (so the admin can replay them if needed).
   */
  const undoGalaStep = useCallback(() => {
    updateCurrentContest((prev) => {
      const votersList = buildJuryVotes(
        prev.teams,
        prev.members,
        prev.votes,
        effectiveVoteMode(prev.teams, prev.members, prev.voteMode)
      );
      const history = prev.gala.history ?? [];

      if (history.length > 0) {
        const lastBatch = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        const newRevealed = prev.gala.revealedTapaIds.filter((id) => !lastBatch.includes(id));
        const previousBatch = newHistory[newHistory.length - 1];

        let lastAwardedTapaId: string | undefined;
        let lastAwardedPoints: number | undefined;
        if (previousBatch) {
          lastAwardedTapaId = previousBatch[previousBatch.length - 1];
          lastAwardedPoints = votersList[prev.gala.currentVoterIndex]?.scores[lastAwardedTapaId];
        }

        return {
          ...prev,
          phase: prev.phase === 'PODIO' ? 'GALA_TV' : prev.phase,
          gala: {
            ...prev.gala,
            step: 'REVELANDO_PUNTOS',
            revealedTapaIds: newRevealed,
            history: newHistory,
            lastAwardedTapaId,
            lastAwardedPoints,
            lastBatchIds: []
          }
        };
      }

      // Nothing revealed for the current voter: step back to the previous juror.
      const index = prev.gala.currentVoterIndex;
      if (index <= 0) return prev;

      const targetIndex = Math.min(index - 1, votersList.length - 1);
      const vote = votersList[targetIndex];
      if (!vote) return prev;

      const sorted = Object.entries(vote.scores).sort((a, b) => a[1] - b[1]);
      const ids = sorted.map(([tapaId]) => tapaId);
      const lastEntry = sorted[sorted.length - 1];

      return {
        ...prev,
        phase: 'GALA_TV',
        gala: {
          ...prev.gala,
          currentVoterIndex: targetIndex,
          step: 'REVELANDO_PUNTOS',
          revealedTapaIds: ids,
          history: ids.map((tapaId) => [tapaId]),
          lastAwardedTapaId: lastEntry?.[0],
          lastAwardedPoints: lastEntry?.[1],
          lastBatchIds: []
        }
      };
    });
  }, [updateCurrentContest]);

  /** Fills `tastingTime` for every team from a start time and a minutes-per-turn interval. */
  const generateTastingSchedule = useCallback(
    (startTime: string, minutesPerTeam: number) => {
      const match = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim());
      if (!match) return;
      const startMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
      const step = Math.max(1, Math.round(minutesPerTeam));

      updateCurrentContest((prev) => {
        const sorted = [...prev.teams].sort((a, b) => a.tastingOrder - b.tastingOrder);
        const times = new Map<string, string>();
        sorted.forEach((team, index) => {
          const total = startMinutes + index * step;
          const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
          const mm = String(total % 60).padStart(2, '0');
          times.set(team.id, `${hh}:${mm}`);
        });
        return {
          ...prev,
          teams: prev.teams.map((team) => ({
            ...team,
            tastingTime: times.get(team.id) ?? team.tastingTime
          }))
        };
      });
    },
    [updateCurrentContest]
  );

  /** Removes every serving time: the contest then shows only the order of the turns. */
  const clearTastingSchedule = useCallback(() => {
    updateCurrentContest((prev) => ({
      ...prev,
      teams: prev.teams.map(({ tastingTime: _removed, ...team }) => team)
    }));
  }, [updateCurrentContest]);

  const simulateSampleVotes = useCallback(() => {
    const generatedVotes = buildSampleVotes(currentContest);

    updateCurrentContest((prev) => ({
      ...prev,
      votes: generatedVotes,
      phase: 'GALA_TV',
      isSimulation: true,
      // The simulation fills every ballot, so the tally is already decided: freeze it too
      voteMode:
        prev.voteMode && prev.voteMode !== 'auto'
          ? prev.voteMode
          : effectiveVoteMode(prev.teams, prev.members, prev.voteMode),
      gala: emptyGala()
    }));

    replaceVotesInCloud(activeContestId, generatedVotes);
  }, [activeContestId, currentContest, updateCurrentContest]);

  const resetContest = useCallback(() => {
    updateCurrentContest((prev) => {
      const first = [...prev.teams].sort((a, b) => a.tastingOrder - b.tastingOrder)[0];
      return {
        ...prev,
        phase: 'SORTEO',
        votes: {},
        isSimulation: false,
        tastingServedUpTo: 0,
        ...(first ? { activeTastingId: first.id } : {}),
        gala: emptyGala()
      };
    });

    // The full-document write deliberately carries no votes; clear the map explicitly
    replaceVotesInCloud(activeContestId, {});
  }, [activeContestId, updateCurrentContest]);

  // ==========================================
  // MULTI-CONTEST MANAGEMENT (FOR SUPERADMIN)
  // ==========================================

  const createContest = useCallback(
    (
      title: string,
      code?: string,
      adminPin: string = MASTER_PIN,
      teamsInput: { memberNames: string[] }[] = []
    ) => {
      const contestId = 'contest_' + Date.now().toString(36);
      const cleanCode = (code || title.substring(0, 4).toUpperCase() + Math.floor(10 + Math.random() * 90)).trim().toUpperCase();
      const seed = Date.now().toString(36);

      const cleanInput = teamsInput
        .map((entry) => ({
          memberNames: entry.memberNames.map((name) => name.trim()).filter(Boolean).slice(0, 3)
        }))
        .filter((entry) => entry.memberNames.length > 0);

      const effectiveInput =
        cleanInput.length > 0
          ? cleanInput
          : [{ memberNames: ['Participante 1'] }, { memberNames: ['Participante 2'] }, { memberNames: ['Participante 3'] }];

      const teams: Team[] = [];
      const members: Member[] = [];

      effectiveInput.forEach((entry, teamIdx) => {
        const teamId = `t_${seed}_${teamIdx + 1}`;
        teams.push({
          id: teamId,
          dishName: '',
          ingredients: [],
          description: '',
          tastingOrder: teamIdx + 1
        });
        entry.memberNames.forEach((name, memberIdx) => {
          members.push({
            id: `m_${seed}_${teamIdx + 1}_${memberIdx + 1}`,
            name,
            pin: generateUniquePin([...members, { id: '__admin', pin: adminPin.trim() }]),
            teamId
          });
        });
      });

      const newContest: ContestState = {
        id: contestId,
        title: title.trim() || 'Nuevo Concurso de Tapas',
        code: cleanCode,
        phase: 'CONFIGURACION',
        adminPin: adminPin.trim() || MASTER_PIN,
        teams,
        members,
        votes: {},
        activeTastingId: teams[0]?.id,
        galaMode: 'CLASICA',
        gala: {
          currentVoterIndex: 0,
          step: 'ESPERANDO',
          revealedTapaIds: [],
          lastBatchIds: [],
          history: []
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

      // Whoever creates a contest manages it from this session
      setSession((prevSession) => {
        if (!prevSession || prevSession.role !== 'superadmin') return prevSession;
        const updated: UserSession = {
          ...prevSession,
          contestId,
          adminContestIds: [...(prevSession.adminContestIds ?? [prevSession.contestId]), contestId]
        };
        try {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
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
      const contestKeys = Object.keys(multiData.contests);
      if (contestKeys.length <= 1) {
        alert('No puedes eliminar el único concurso disponible.');
        return;
      }

      const remaining = { ...multiData.contests };
      delete remaining[contestId];
      const nextDataActiveId =
        multiData.activeContestId === contestId ? Object.keys(remaining)[0] : multiData.activeContestId;

      setMultiData((prev) => {
        if (!prev.contests[contestId] || Object.keys(prev.contests).length <= 1) return prev;
        const nextRemaining = { ...prev.contests };
        delete nextRemaining[contestId];
        const nextId =
          prev.activeContestId === contestId ? Object.keys(nextRemaining)[0] : prev.activeContestId;
        return persistMultiData({ activeContestId: nextId, contests: nextRemaining });
      });

      // If the organizer was inside that contest, the session has to move with the data. Otherwise
      // every later edit would target a contest that no longer exists and resurrect it.
      setSession((prevSession) => {
        if (!prevSession) return prevSession;
        const opened = prevSession.adminContestIds ?? [prevSession.contestId];
        if (prevSession.contestId !== contestId && !opened.includes(contestId)) return prevSession;

        const nextContestId = prevSession.contestId === contestId ? nextDataActiveId : prevSession.contestId;
        const nextIds = opened.filter((id) => id !== contestId);
        const updated: UserSession = {
          ...prevSession,
          contestId: nextContestId,
          ...(prevSession.role === 'superadmin'
            ? { adminContestIds: nextIds.length > 0 ? nextIds : [nextContestId] }
            : {})
        };
        try {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });

      // Async remove from Firestore
      if (!IS_SANDBOX) deleteDoc(contestRef(contestId)).catch(() => {});
    },
    [multiData]
  );

  /** Adds a new tapa/team with 1-3 members to a contest. */
  const addTeamToContest = useCallback(
    (contestId: string, memberNames: string[]) => {
      const current = multiData.contests[contestId];
      if (!current) return;
      // A new rival after the first ballot would get points nobody could give it
      if (Object.keys(current.votes).length > 0) {
        alert('Ya hay votos sellados. Reinicia la votación antes de añadir o quitar equipos.');
        return;
      }

      setMultiData((prev) => {
        const contest = prev.contests[contestId];
        if (!contest) return prev;
        if (Object.keys(contest.votes).length > 0) return prev;

        const names = memberNames.map((name) => name.trim()).filter(Boolean).slice(0, 3);
        if (names.length === 0) return prev;

        const seed = Date.now().toString(36);
        const teamId = `t_${seed}_${Math.random().toString(36).slice(2, 5)}`;
        const newMembers: Member[] = [];
        names.forEach((name, idx) => {
          const pin = generateUniquePin([...contest.members, ...newMembers, { id: '__admin', pin: contest.adminPin }]);
          newMembers.push({
            id: `m_${seed}_${idx + 1}`,
            name,
            pin,
            teamId
          });
        });

        const newTeam: Team = {
          id: teamId,
          dishName: '',
          ingredients: [],
          description: '',
          tastingOrder: contest.teams.length + 1
        };

        const updatedContest: ContestState = {
          ...contest,
          teams: [...contest.teams, newTeam],
          members: [...contest.members, ...newMembers],
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
    [multiData]
  );

  const removeTeamFromContest = useCallback(
    (contestId: string, teamId: string) => {
      const current = multiData.contests[contestId];
      if (!current) return;
      if (current.teams.length <= 1) {
        alert('No puedes eliminar el único equipo del concurso.');
        return;
      }
      if (Object.keys(current.votes).length > 0) {
        alert('Ya hay votos sellados. Reinicia la votación antes de añadir o quitar equipos.');
        return;
      }

      const removedMemberIds = current.members.filter((m) => m.teamId === teamId).map((m) => m.id);

      setMultiData((prev) => {
        const contest = prev.contests[contestId];
        if (!contest) return prev;
        if (contest.teams.length <= 1 || Object.keys(contest.votes).length > 0) return prev;

        const teams = contest.teams
          .filter((team) => team.id !== teamId)
          .map((team, idx) => ({ ...team, tastingOrder: idx + 1 }));

        const members = contest.members.filter((m) => m.teamId !== teamId);

        const votes = { ...contest.votes };
        removedMemberIds.forEach((id) => {
          delete votes[id];
        });

        const updatedContest: ContestState = {
          ...contest,
          teams,
          members,
          votes,
          activeTastingId:
            contest.activeTastingId === teamId ? teams[0]?.id : contest.activeTastingId,
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

      // The normal full-document write carries no votes, so remove their fields explicitly
      removedMemberIds.forEach((id) => deleteVoteInCloud(contestId, id));
    },
    [multiData]
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

      // Check if code is a member PIN (members take priority so an admin PIN can never leak access to them)
      if (chosenContest) {
        const matched = chosenContest.members.find((m) => m.pin === code);
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

      // Organizer: only the admin PIN of the selected contest opens it (there is no master PIN)
      if (chosenContest && chosenContest.adminPin === code) {
        const newSession: UserSession = {
          role: 'superadmin',
          contestId: chosenContest.id,
          adminContestIds: adminContestIdsFor(multiData, code, chosenContest.id)
        };
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
        const member = c.members.find((m) => m.pin === code);
        return member ? [{ contest: c, member }] : [];
      });

      if (matches.length === 1) {
        const match = matches[0];
        const newSession: UserSession = {
          role: 'participant',
          contestId: match.contest.id,
          participantId: match.member.id
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

  // Current logged in member (if role === 'participant') and the team they cook with
  const currentMember = useMemo(() => {
    if (session?.role !== 'participant' || !session.participantId) return null;
    return currentContest.members.find((m) => m.id === session.participantId) || null;
  }, [session, currentContest]);

  const currentTeam = useMemo(() => {
    if (!currentMember) return null;
    return currentContest.teams.find((team) => team.id === currentMember.teamId) || null;
  }, [currentMember, currentContest]);

  return {
    // Current contest state & actions
    state: displayContest,
    setPhase,
    updateTeam,
    updateMemberPin,
    regenerateMemberPin,
    reorderTasting,
    confirmDraw,
    submitVote,
    removeVote,
    setActiveTasting,
    nextGalaStep,
    undoGalaStep,
    setGalaMode,
    setTvTheme,
    setVoteMode,
    generateTastingSchedule,
    clearTastingSchedule,
    simulateSampleVotes,
    resetContest,

    // Multi-contest state & management
    multiData,
    contestsList: Object.values(multiData.contests),
    // Contests this organizer session has the PIN for (legacy sessions: just the one they are in)
    adminContestsList: Object.values(multiData.contests).filter((c) =>
      (session?.adminContestIds ?? (session ? [session.contestId] : [])).includes(c.id)
    ),
    activeContestId,
    createContest,
    switchContest,
    deleteContest,
    addTeamToContest,
    removeTeamFromContest,
    updateContestMeta,

    // Session & Auth
    session,
    currentMember,
    currentTeam,
    loginWithCode,
    loginAsTV,
    logout,

    // Access link bootstrap
    booting,
    bootstrapError,
    remoteContests,
    cloudStatus
  };
}
