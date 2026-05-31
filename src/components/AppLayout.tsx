import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { MapIcon, ClockIcon, HeartIcon, UserIcon, ReceiptIcon, BoltIcon, ChevronRight } from './icons.tsx';
import { WelcomeOverlay } from './WelcomeOverlay.tsx';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { money } from './ui.tsx';
import { reportedSoc } from '../lib/types.ts';
import { useT } from '../lib/i18n.tsx';

const TABS = [
  { to: '/', label: 'Charge', Icon: MapIcon, end: true },
  { to: '/activity', label: 'Activity', Icon: ReceiptIcon },
  { to: '/reservations', label: 'Reserved', Icon: ClockIcon },
  { to: '/favorites', label: 'Saved', Icon: HeartIcon },
  { to: '/account', label: 'Account', Icon: UserIcon },
];

export function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { activeSession } = usePhevnix();
  const { t } = useT();
  // Hide the tab bar on full-screen flows (charger detail, active session, auth).
  const hideNav = /^\/(charger|session|location|login|register)/.test(pathname);
  // Persistent active-session strip on tabbed screens — monitor/resume from anywhere.
  const showSessionBar = !!activeSession && !hideNav;
  return (
    <div className="phone-shell">
      <div className="phone-frame flex flex-col">
        <WelcomeOverlay />
        <main className={`no-scrollbar flex-1 overflow-y-auto ${showSessionBar ? 'pb-40' : 'pb-24'}`}>
          <Outlet />
        </main>
        {showSessionBar && activeSession && (
          <button
            onClick={() => navigate('/session')}
            className="absolute inset-x-0 bottom-[60px] z-20 mx-auto flex max-w-[430px] items-center gap-3 border-t border-volt/30 bg-ink/95 px-4 py-2.5 text-left backdrop-blur"
            aria-label={t('Charging')}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-volt/15 text-volt">
              <BoltIcon className="h-5 w-5 animate-pulse-volt" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-volt">{t('Charging')}</span>
              <span className="block truncate text-[11.5px] text-text-soft">
                {reportedSoc(activeSession) != null && `🔋 ${Math.round(reportedSoc(activeSession)!)}% · `}
                {(activeSession.energyDeliveredKwh ?? 0).toFixed(1)} kWh
                {(activeSession.currentPowerKw ?? 0) > 0 && ` · ${(activeSession.currentPowerKw ?? 0).toFixed(1)} kW`}
                {` · ${money(activeSession.total ?? activeSession.cost ?? 0, activeSession.currency)}`}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-volt" />
          </button>
        )}
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
                  {t(label)}
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
