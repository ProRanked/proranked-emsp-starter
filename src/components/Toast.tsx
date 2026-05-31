import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { BoltIcon } from './icons.tsx';

export interface ToastOptions {
  title: string;
  body?: string;
  tone?: 'volt' | 'warn';
  onClick?: () => void;
  durationMs?: number;
}
interface ToastItem extends ToastOptions {
  id: number;
}

const ToastCtx = createContext<{ notify: (o: ToastOptions) => void }>({ notify: () => {} });

/**
 * Lightweight in-app notifications — a top-anchored stack of auto-dismissing toasts.
 * Used for session events (charging started / complete) so the app acknowledges
 * what's happening even when the driver isn't on the live-session screen.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (o: ToastOptions) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setItems((xs) => [...xs.slice(-2), { ...o, id }]); // keep at most 3 on screen
      window.setTimeout(() => dismiss(id), o.durationMs ?? 5000);
    },
    [dismiss],
  );

  return (
    <ToastCtx.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[3000] mx-auto flex max-w-[420px] flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              t.onClick?.();
              dismiss(t.id);
            }}
            className={`pointer-events-auto flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-xl backdrop-blur transition animate-[toastIn_180ms_ease-out] ${
              t.tone === 'warn' ? 'border-amber/40 bg-ink/95' : 'border-volt/40 bg-ink/95'
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                t.tone === 'warn' ? 'bg-amber/15 text-amber' : 'bg-volt/15 text-volt'
              }`}
            >
              <BoltIcon className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-[13.5px] font-bold ${t.tone === 'warn' ? 'text-amber' : 'text-volt'}`}>{t.title}</span>
              {t.body && <span className="block truncate text-[12px] text-text-soft">{t.body}</span>}
            </span>
          </button>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
