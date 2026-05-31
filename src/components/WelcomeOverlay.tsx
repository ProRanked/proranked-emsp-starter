import { useState } from 'react';
import { Button } from './ui.tsx';
import { MapIcon, BoltIcon, ReceiptIcon } from './icons.tsx';

const KEY = 'voltway.onboarded';

/**
 * First-run welcome. Shows once per device (localStorage), then never again.
 * A small, native-feeling intro to the three things the app does.
 */
export function WelcomeOverlay() {
  const [done, setDone] = useState(() => {
    try { return localStorage.getItem(KEY) === '1'; } catch { return true; }
  });
  if (done) return null;

  const finish = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    setDone(true);
  };

  const items = [
    { Icon: MapIcon, title: 'Find a charger', sub: 'Live map of nearby sites, coloured by availability.' },
    { Icon: BoltIcon, title: 'Start in a tap', sub: 'Tap a charger to start — watch energy climb in real time.' },
    { Icon: ReceiptIcon, title: 'Get a receipt', sub: 'Every session itemised, with history and totals.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 px-5 pb-8 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-volt text-ink"><BoltIcon className="h-6 w-6" /></div>
          <div>
            <h2 className="text-[19px] font-extrabold leading-tight">Welcome to Voltway</h2>
            <p className="text-[12.5px] text-text-soft">Charge anywhere. Pay your way.</p>
          </div>
        </div>
        <div className="space-y-4">
          {items.map(({ Icon, title, sub }) => (
            <div key={title} className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-volt/10 text-volt"><Icon className="h-5 w-5" /></div>
              <div>
                <p className="text-[14.5px] font-semibold">{title}</p>
                <p className="text-[12.5px] text-text-soft">{sub}</p>
              </div>
            </div>
          ))}
        </div>
        <Button className="mt-6" onClick={finish}>Get started</Button>
      </div>
    </div>
  );
}
