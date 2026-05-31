import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { MapIcon, ClockIcon, HeartIcon, UserIcon, ReceiptIcon } from './icons.tsx';

const TABS = [
  { to: '/', label: 'Charge', Icon: MapIcon, end: true },
  { to: '/activity', label: 'Activity', Icon: ReceiptIcon },
  { to: '/reservations', label: 'Reserved', Icon: ClockIcon },
  { to: '/favorites', label: 'Saved', Icon: HeartIcon },
  { to: '/account', label: 'Account', Icon: UserIcon },
];

export function AppLayout() {
  const { pathname } = useLocation();
  // Hide the tab bar on full-screen flows (charger detail, active session, auth).
  const hideNav = /^\/(charger|session|location|login|register)/.test(pathname);
  return (
    <div className="phone-shell">
      <div className="phone-frame flex flex-col">
        <main className="no-scrollbar flex-1 overflow-y-auto pb-24">
          <Outlet />
        </main>
        {!hideNav && (
          <nav className="absolute inset-x-0 bottom-0 z-20 border-t border-line bg-ink/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur">
            <div className="mx-auto flex max-w-[430px] items-stretch justify-around">
              {TABS.map(({ to, label, Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition ${
                      isActive ? 'text-volt' : 'text-text-faint hover:text-text-soft'
                    }`
                  }
                >
                  <Icon className="h-[22px] w-[22px]" />
                  {label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

// Reusable screen header with optional back button.
export function ScreenHeader({ title, subtitle, action, back }: { title: string; subtitle?: ReactNode; action?: ReactNode; back?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line/60 bg-ink/85 px-4 py-3.5 backdrop-blur">
      {back}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-[12px] text-text-soft">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
