import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PhevnixEmspClient, type DriverSession } from '../lib/phevnix.ts';
import { asArray, type ChargingSession, type Driver } from '../lib/types.ts';

const STORAGE_KEY = 'voltway.session';

function readSaved(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedSession) : null;
  } catch {
    return null;
  }
}

// The publishable eMSP key — safe to embed in a client app (read-only until a driver logs in).
const API_KEY = (import.meta.env.VITE_EMSP_API_KEY as string | undefined) ?? '';

interface PersistedSession {
  accessToken: string;
  refreshToken?: string;
  tokenUid?: string;
  driver: Driver;
}

interface PhevnixContextValue {
  client: PhevnixEmspClient;
  driver: Driver | null;
  keyConfigured: boolean;
  /**
   * The driver's currently-running charging session, or null. Polled centrally so
   * every screen (home banner, charger page, live session) reflects the same backend
   * truth — including a session started on another device or before this app loaded.
   */
  activeSession: ChargingSession | null;
  /** Re-fetch the active session immediately (call right after start/stop). */
  refreshActiveSession: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => void;
}

const PhevnixContext = createContext<PhevnixContextValue | null>(null);

export function PhevnixProvider({ children }: { children: ReactNode }) {
  const [driver, setDriver] = useState<Driver | null>(() => readSaved()?.driver ?? null);

  // Calls go same-origin (window.location.origin) and Vite proxies /emsp → the gateway.
  // Rehydrate any saved session synchronously so a page reload doesn't bounce to /login
  // before an effect runs (the auth guard reads `driver` on the very first render).
  const client = useMemo(() => {
    const c = new PhevnixEmspClient({
      baseUrl: window.location.origin,
      apiKey: API_KEY,
      onTokensChanged: (t) => {
        if (!t.accessToken) {
          // The token expired AND the refresh failed (or there's no refresh token). Log out so
          // the auth guard routes to /login instead of every screen erroring with a stale token.
          localStorage.removeItem(STORAGE_KEY);
          setDriver(null);
          return;
        }
        // Persist silently-refreshed (rotated) tokens so a reload keeps the session alive.
        const saved = readSaved();
        if (!saved) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, accessToken: t.accessToken, refreshToken: t.refreshToken ?? saved.refreshToken, tokenUid: t.tokenUid ?? saved.tokenUid }));
      },
    });
    const saved = readSaved();
    if (saved) c.restoreSession(saved);
    return c;
  }, []);

  // Centralized active-session truth. Polls while a driver is signed in so the app
  // surfaces a session it didn't start in-app (fresh login, reload, another device).
  const [activeSession, setActiveSession] = useState<ChargingSession | null>(null);

  // Find the live session, then enrich it from the detail endpoint. The session
  // *list* DTO is lean (no live power), but the *detail* DTO carries currentPowerKw,
  // maxPowerKw and the full cost breakdown — so "kW now" and the charging curve
  // reflect real charging instead of reading zero.
  const fetchActiveSession = async (): Promise<ChargingSession | null> => {
    const head = asArray<ChargingSession>(await client.listSessions({ status: 'ACTIVE', pageSize: 1 }))[0];
    if (!head?.id) return null;
    try {
      return (await client.getSession(head.id)) as ChargingSession;
    } catch {
      return head; // detail fetch failed — fall back to the list row
    }
  };

  const refreshActiveSession = () => {
    fetchActiveSession()
      .then(setActiveSession)
      .catch(() => {
        /* transient poll error — keep the last known value */
      });
  };

  useEffect(() => {
    if (!driver) {
      setActiveSession(null);
      return;
    }
    let alive = true;
    const tick = () => {
      fetchActiveSession()
        .then((s) => {
          if (alive) setActiveSession(s);
        })
        .catch(() => {
          /* ignore transient poll errors */
        });
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [driver, client]);

  function persist(session: DriverSession) {
    const driverInfo: Driver = { ...session.driver, tokenUid: session.driver?.tokenUid ?? client.tokenUid };
    const payload: PersistedSession = {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      tokenUid: client.tokenUid,
      driver: driverInfo,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setDriver(driverInfo);
  }

  const value: PhevnixContextValue = {
    client,
    driver,
    keyConfigured: API_KEY.length > 0,
    activeSession,
    refreshActiveSession,
    login: async (email, password) => persist(await client.login(email, password)),
    register: async (input) => persist(await client.register(input)),
    logout: () => {
      client.clearSession();
      localStorage.removeItem(STORAGE_KEY);
      setDriver(null);
      setActiveSession(null);
    },
  };

  return <PhevnixContext.Provider value={value}>{children}</PhevnixContext.Provider>;
}

export function usePhevnix(): PhevnixContextValue {
  const ctx = useContext(PhevnixContext);
  if (!ctx) throw new Error('usePhevnix must be used inside <PhevnixProvider>');
  return ctx;
}
