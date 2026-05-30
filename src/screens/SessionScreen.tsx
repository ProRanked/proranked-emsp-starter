import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { Button, Card, Banner, money } from '../components/ui.tsx';
import { ChevronLeft, BoltIcon, PowerIcon } from '../components/icons.tsx';
import { asArray, type ChargingSession } from '../lib/types.ts';

export function SessionScreen() {
  const { client } = usePhevnix();
  const navigate = useNavigate();
  const nav = useLocation();
  const state = (nav.state ?? {}) as { sessionId?: string; chargerId?: string; connector?: number };
  const chargerId = state.chargerId ?? sessionStorage.getItem('voltway.activeCharger') ?? '';

  const [session, setSession] = useState<ChargingSession | null>(null);
  const [limit, setLimit] = useState(16);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const limitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Poll for the driver's active session.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const rows = asArray<ChargingSession>(await client.listSessions({ status: 'ACTIVE', pageSize: 1 }));
        if (alive) setSession(rows[0] ?? null);
      } catch {
        /* ignore poll errors */
      }
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [client]);

  function changeLimit(a: number) {
    setLimit(a);
    setLimitMsg(null);
    clearTimeout(limitTimer.current);
    if (!chargerId) return;
    limitTimer.current = setTimeout(async () => {
      try {
        await client.setChargingLimit(chargerId, { connectorNumber: state.connector ?? 1, unit: 'A', limit: a });
        setLimitMsg(`Limit set to ${a} A`);
      } catch (e) {
        setLimitMsg(e instanceof Error ? e.message : 'Could not set limit');
      }
    }, 500);
  }

  async function stop() {
    if (!session?.id) {
      setNote('No active session to stop.');
      return;
    }
    setStopping(true);
    try {
      await client.stopCharging(session.id);
      sessionStorage.removeItem('voltway.activeCharger');
      navigate('/', { replace: true });
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not stop session');
    } finally {
      setStopping(false);
    }
  }

  const kwh = session?.energyDeliveredKwh ?? 0;
  const power = session?.currentPowerKw ?? 0;
  const mins = session?.durationSeconds != null ? Math.floor(session.durationSeconds / 60) : 0;
  const active = !!session;

  return (
    <div>
      <ScreenHeader
        title={active ? 'Charging' : 'Charging controls'}
        back={<button onClick={() => navigate('/')} className="-ml-1 text-text-soft"><ChevronLeft className="h-6 w-6" /></button>}
      />

      <div className="space-y-6 px-5 py-6">
        {/* Charging gauge */}
        <div className="relative mx-auto flex h-60 w-60 items-center justify-center">
          <div className={`absolute inset-0 rounded-full border-[10px] ${active ? 'border-volt/25' : 'border-line'}`} />
          <div className={`absolute inset-0 rounded-full border-[10px] border-transparent ${active ? 'border-t-volt animate-spin [animation-duration:3s]' : ''}`} />
          <div className="text-center">
            <div className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full ${active ? 'bg-volt/15 text-volt animate-pulse-volt' : 'bg-card-2 text-text-faint'}`}>
              <BoltIcon className="h-7 w-7" />
            </div>
            <p className="text-[40px] font-extrabold leading-none">{kwh.toFixed(1)}</p>
            <p className="text-[13px] text-text-soft">kWh delivered</p>
          </div>
        </div>

        {!active && (
          <Banner tone="info">No active session. Start one from a charger — your live energy, power, and cost will appear here.</Banner>
        )}

        {/* Live stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center"><p className="text-[18px] font-bold">{power.toFixed(1)}</p><p className="text-[11px] text-text-soft">kW now</p></Card>
          <Card className="text-center"><p className="text-[18px] font-bold">{mins}</p><p className="text-[11px] text-text-soft">minutes</p></Card>
          <Card className="text-center"><p className="text-[18px] font-bold">{money(session?.cost ?? 0, session?.currency)}</p><p className="text-[11px] text-text-soft">cost</p></Card>
        </div>

        {/* Charging speed limit */}
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[14px] font-semibold">Charging speed</p>
            <span className="rounded-full bg-volt/10 px-2.5 py-1 text-[12px] font-bold text-volt">{limit} A</span>
          </div>
          <input
            type="range"
            min={6}
            max={32}
            step={1}
            value={limit}
            onChange={(e) => changeLimit(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-volt"
          />
          <div className="mt-1 flex justify-between text-[11px] text-text-faint"><span>Eco · 6 A</span><span>Max · 32 A</span></div>
          {limitMsg && <p className="mt-2 text-[12px] text-volt">{limitMsg}</p>}
        </Card>

        {note && <Banner tone="warn">{note}</Banner>}

        <Button variant="danger" onClick={stop} loading={stopping} disabled={!active}>
          <PowerIcon className="h-5 w-5" /> Stop charging
        </Button>
      </div>
    </div>
  );
}
