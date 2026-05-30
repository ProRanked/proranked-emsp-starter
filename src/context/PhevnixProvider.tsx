import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { PhevnixEmspClient, type DriverSession } from '../lib/phevnix.ts';
import type { Driver } from '../lib/types.ts';

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
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => void;
}

const PhevnixContext = createContext<PhevnixContextValue | null>(null);

export function PhevnixProvider({ children }: { children: ReactNode }) {
  // Calls go same-origin (window.location.origin) and Vite proxies /emsp → the gateway.
  // Rehydrate any saved session synchronously so a page reload doesn't bounce to /login
  // before an effect runs (the auth guard reads `driver` on the very first render).
  const client = useMemo(() => {
    const c = new PhevnixEmspClient({ baseUrl: window.location.origin, apiKey: API_KEY });
    const saved = readSaved();
    if (saved) c.restoreSession(saved);
    return c;
  }, []);

  const [driver, setDriver] = useState<Driver | null>(() => readSaved()?.driver ?? null);

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
    login: async (email, password) => persist(await client.login(email, password)),
    register: async (input) => persist(await client.register(input)),
    logout: () => {
      client.clearSession();
      localStorage.removeItem(STORAGE_KEY);
      setDriver(null);
    },
  };

  return <PhevnixContext.Provider value={value}>{children}</PhevnixContext.Provider>;
}

export function usePhevnix(): PhevnixContextValue {
  const ctx = useContext(PhevnixContext);
  if (!ctx) throw new Error('usePhevnix must be used inside <PhevnixProvider>');
  return ctx;
}
