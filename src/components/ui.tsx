import { useCallback, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { PhevnixApiError } from '../lib/phevnix.ts';

// ── Status pill (charger/session/reservation states) ──────────────────────
const STATUS_TONE: Record<string, string> = {
  available: 'bg-volt/15 text-volt',
  active: 'bg-volt/15 text-volt',
  charging: 'bg-volt/15 text-volt',
  accepted: 'bg-volt/15 text-volt',
  pending: 'bg-amber/15 text-amber',
  reserved: 'bg-amber/15 text-amber',
  occupied: 'bg-amber/15 text-amber',
  suspendedev: 'bg-amber/15 text-amber',
  unknown: 'bg-line text-text-faint',
  offline: 'bg-line text-text-faint',
  inoperative: 'bg-rose/15 text-rose',
  faulted: 'bg-rose/15 text-rose',
  rejected: 'bg-rose/15 text-rose',
  cancelled: 'bg-line text-text-faint',
};

export function StatusPill({ status }: { status?: string }) {
  const key = (status ?? 'unknown').toLowerCase();
  const tone = STATUS_TONE[key] ?? 'bg-line text-text-faint';
  const label = (status ?? 'Unknown').replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'volt' | 'ghost' | 'danger' | 'outline';
  loading?: boolean;
};

export function Button({ variant = 'volt', loading, children, className = '', disabled, ...rest }: BtnProps) {
  const styles = {
    volt: 'bg-volt text-ink hover:brightness-110 active:brightness-95 shadow-[0_8px_24px_-8px_rgba(46,230,166,0.5)]',
    outline: 'border border-line text-text hover:bg-card-2',
    ghost: 'text-text-soft hover:text-text hover:bg-card-2',
    danger: 'bg-rose/15 text-rose hover:bg-rose/25',
  }[variant];
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition disabled:opacity-50 ${styles} ${className}`}
      {...rest}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-5 w-5 animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────
export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-3xl border border-line bg-card p-4 ${onClick ? 'cursor-pointer transition active:scale-[0.99] hover:border-volt-dim' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

// ── Skeleton loaders ────────────────────────────────────────────────────────
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-line/60 ${className}`} />;
}

/** A few card-shaped skeleton rows — used while lists load (perceived speed). */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 rounded-3xl border border-line bg-card p-4">
          <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A failed-load state with a retry affordance — pairs with useAsync().reload. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-card px-5 py-8 text-center">
      <p className="text-[13px] text-text-soft">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-full border border-line px-5 py-2 text-[13px] font-semibold text-volt transition hover:border-volt-dim">
          Try again
        </button>
      )}
    </div>
  );
}

// ── Text field ────────────────────────────────────────────────────────────
export function Field({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-text-soft">{label}</span>
      <input
        className="h-12 w-full rounded-2xl border border-line bg-ink-soft px-4 text-[15px] text-text placeholder:text-text-faint outline-none focus:border-volt-dim"
        {...rest}
      />
    </label>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${checked ? 'bg-volt' : 'bg-line'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

// ── Empty / error states ──────────────────────────────────────────────────
export function EmptyState({ icon, title, subtitle }: { icon?: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {icon && <div className="mb-1 text-text-faint">{icon}</div>}
      <p className="text-[15px] font-semibold text-text">{title}</p>
      {subtitle && <p className="max-w-[260px] text-[13px] text-text-soft">{subtitle}</p>}
    </div>
  );
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'volt'; children: ReactNode }) {
  const t = {
    info: 'border-line bg-card-2 text-text-soft',
    warn: 'border-amber/30 bg-amber/10 text-amber',
    volt: 'border-volt-dim/40 bg-volt/10 text-volt',
  }[tone];
  return <div className={`rounded-2xl border px-4 py-3 text-[13px] ${t}`}>{children}</div>;
}

// ── useAsync: load data, surface feature_disabled gracefully ──────────────
export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  /** Set when the capability is disabled for this network (403 feature_disabled). */
  featureDisabled: boolean;
  reload: () => void;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [tick, setTick] = useState(0);

  const run = useCallback(fn, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setFeatureDisabled(false);
    run()
      .then((d) => alive && setData(d))
      .catch((e) => {
        if (!alive) return;
        if (e instanceof PhevnixApiError && e.errorCode === 'feature_disabled') setFeatureDisabled(true);
        else setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [run, tick]);

  return { data, loading, error, featureDisabled, reload: () => setTick((t) => t + 1) };
}

export function money(amount?: number, currency = 'USD'): string {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
