import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { Button, Card, Banner, money } from '../components/ui.tsx';
import { ChevronLeft, BoltIcon, PowerIcon, BatteryIcon, PlugIcon } from '../components/icons.tsx';
import { PowerCurve } from '../components/PowerCurve.tsx';
import { reportedSoc } from '../lib/types.ts';
import { useT } from '../lib/i18n.tsx';

// Charging-speed slider bounds. Default to MAX so a session charges as fast as the charger allows
// unless the driver deliberately dials it down — not a misleading half-speed default.
const MIN_AMPS = 6;
const MAX_AMPS = 32;
// Treat the charger as unresponsive if no fresh meter reading has advanced the delivered
// energy within this window — surfaces a dropped/offline charger so the session view stops
// pretending to charge (and so remote commands don't falsely claim success).
const STALE_MS = 100_000;

export function SessionScreen() {
  const { client, activeSession: session, refreshActiveSession } = usePhevnix();
  const navigate = useNavigate();
  const nav = useLocation();
  const { t } = useT();
  const state = (nav.state ?? {}) as { sessionId?: string; chargerId?: string; connector?: number };
  // Limit/stop need a charger + connector. Prefer the live session's own values so a
  // RESUMED session (opened on fresh login, with no nav state) is still controllable.
  const chargerId = state.chargerId ?? session?.chargerId ?? sessionStorage.getItem('voltway.activeCharger') ?? '';
  const connectorNumber = state.connector ?? session?.connectorNumber ?? 1;

  const [limit, setLimit] = useState(MAX_AMPS);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const limitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [goalKwh, setGoalKwh] = useState<number | null>(null);
  // Opt-in charge limit: auto-stop when the EV battery reaches a target SoC (like Tesla/ChargePoint).
  const [socLimit, setSocLimit] = useState<number | null>(null);
  const autoStopped = useRef(false);
  // SmartCharging may be disabled for the network — when so, hide the speed slider (it's inert).
  const [smartChargingOff, setSmartChargingOff] = useState(false);
  // Wall-clock of the last time delivered energy advanced — basis for the stale/offline check.
  const lastProgressRef = useRef<number>(Date.now());
  // Wall-clock tick (1s) so the elapsed timer counts up smoothly between the
  // slower session polls.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Live power history for the charging curve. Sampled off the centrally-polled
  // session: append a point whenever delivered energy advances (a fresh poll),
  // capped to a rolling window so the chart stays light.
  const [history, setHistory] = useState<number[]>([]);
  const lastEnergy = useRef<number>(-1);
  useEffect(() => {
    if (!session) {
      setHistory([]);
      lastEnergy.current = -1;
      return;
    }
    const e = session.energyDeliveredKwh ?? 0;
    if (e !== lastEnergy.current) {
      lastEnergy.current = e;
      lastProgressRef.current = Date.now(); // energy advanced → charger is live & reporting
      setHistory((h) => [...h, session.currentPowerKw ?? 0].slice(-80));
    }
  }, [session]);

  // The active session is polled centrally by the provider; kick one immediate refresh
  // on mount so a just-started or just-opened session shows without a poll delay.
  useEffect(() => {
    refreshActiveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charge limit: once the live battery SoC reaches the chosen target, stop the session
  // automatically (exactly once). Opt-in and only armed when the charger reports SoC.
  const socNow = reportedSoc(session);
  useEffect(() => {
    if (!session) { autoStopped.current = false; return; }
    if (socLimit == null || socNow == null || autoStopped.current) return;
    if (socNow >= socLimit) {
      autoStopped.current = true;
      setNote(t('Charge limit reached — stopping.'));
      void stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socNow, socLimit, session?.id]);

  function changeLimit(a: number) {
    setLimit(a);
    setLimitMsg(null);
    clearTimeout(limitTimer.current);
    if (!chargerId) return;
    limitTimer.current = setTimeout(async () => {
      try {
        await client.setChargingLimit(chargerId, { connectorNumber, unit: 'A', limit: a });
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
      const stoppedId = session.id;
      await client.stopCharging(stoppedId);
      sessionStorage.removeItem('voltway.activeCharger');
      refreshActiveSession();
      // Land on the itemized receipt for the session that just ended.
      navigate(`/activity/${stoppedId}`, { replace: true });
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not stop session');
    } finally {
      setStopping(false);
    }
  }

  // Seed the slider from the charger's CURRENT effective limit (GET /smart-charging/{id}/limit).
  useEffect(() => {
    if (!chargerId) return;
    let alive = true;
    (async () => {
      try {
        const eff = (await client.getChargingLimit(chargerId, connectorNumber, 'A')) as { limit?: number };
        if (alive && typeof eff?.limit === 'number' && eff.limit >= MIN_AMPS && eff.limit <= MAX_AMPS) setLimit(eff.limit);
      } catch (e) {
        // SmartCharging may be disabled for this network (403 feature_disabled) — hide the
        // speed control rather than leaving an inert slider on screen.
        const err = e as { status?: number; errorCode?: string };
        if (alive && (err?.errorCode === 'feature_disabled' || err?.status === 403)) setSmartChargingOff(true);
        /* otherwise: no limit set — keep the default (max) */
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargerId]);

  async function clearLimit() {
    if (!chargerId) return;
    setLimit(MAX_AMPS); setLimitMsg(null);
    try { await client.clearChargingLimit(chargerId, connectorNumber); setLimitMsg(t('Limit cleared — charging at full speed.')); }
    catch (e) { setLimitMsg(e instanceof Error ? e.message : 'Could not clear limit'); }
  }

  async function unlockCable() {
    if (!chargerId) return;
    setNote(null);
    // Unlock is fire-and-forget at the backend — it returns OK even when the charger is
    // unreachable. If we haven't heard from the charger recently, don't falsely confirm
    // "unlocked"; tell the driver it may not have reached the charger.
    if (Date.now() - lastProgressRef.current > STALE_MS) {
      setNote(t("The charger isn't responding right now — an unlock may not reach it. Try Refresh status first."));
      return;
    }
    try { await client.unlockConnector(chargerId, connectorNumber); setNote(t('Connector unlocked — you can unplug.')); }
    catch (e) { setNote(e instanceof Error ? e.message : 'Could not unlock the connector'); }
  }

  async function refreshStatus() {
    if (!chargerId) return;
    try { await client.triggerMessage(chargerId, 'MeterValues', connectorNumber); refreshActiveSession(); }
    catch { /* best-effort refresh */ }
  }

  const kwh = session?.energyDeliveredKwh ?? 0;
  const power = session?.currentPowerKw ?? 0;
  const soc = reportedSoc(session);
  // Elapsed time ticks client-side from the session start. CPO returns
  // durationSeconds=0 for an in-flight session, so relying on it freezes the
  // timer at 0. SessionStartDateTimeUtc is a UTC instant that may serialize
  // without a 'Z' — treat a tz-less value as UTC so the count is right in any
  // local zone. max() with durationSeconds keeps a completed session correct.
  const startMs = session?.startTime
    ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(session.startTime) ? session.startTime : session.startTime + 'Z').getTime()
    : null;
  const elapsedSec = startMs != null
    ? Math.max(session?.durationSeconds ?? 0, Math.floor((nowTs - startMs) / 1000))
    : (session?.durationSeconds ?? 0);
  const elapsed = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`;
  const active = !!session;
  // Charger unresponsive: no fresh energy reading has advanced within STALE_MS (dropped/offline).
  const stale = active && nowTs - lastProgressRef.current > STALE_MS;
  const peakKw = history.length ? Math.max(...history) : power;
  const avgKw = history.length ? history.reduce((a, b) => a + b, 0) / history.length : power;
  // Charge goal → live ETA from current power (now that currentPowerKw is real).
  const goalReached = goalKwh != null && kwh >= goalKwh;
  const goalPct = goalKwh ? Math.min(100, (kwh / goalKwh) * 100) : 0;
  const etaMin = goalKwh != null && power > 0.1 && !goalReached ? Math.ceil(((goalKwh - kwh) / power) * 60) : null;

  return (
    <div>
      <ScreenHeader
        title={active ? t('Charging') : t('Charging controls')}
        back={<button aria-label="Go back" onClick={() => navigate('/')} className="-ml-1 text-text-soft"><ChevronLeft className="h-6 w-6" /></button>}
      />

      <div className="space-y-6 px-5 py-6">
        {/* Charging gauge */}
        <div className="relative mx-auto flex h-60 w-60 items-center justify-center">
          <div className={`absolute inset-0 rounded-full border-[10px] ${active ? 'border-volt/25' : 'border-line'}`} />
          <div className={`absolute inset-0 rounded-full border-[10px] border-transparent ${active && !stale ? 'border-t-volt animate-spin [animation-duration:3s]' : ''}`} />
          <div className="text-center">
            <div className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full ${active && !stale ? 'bg-volt/15 text-volt animate-pulse-volt' : 'bg-card-2 text-text-faint'}`}>
              <BoltIcon className="h-7 w-7" />
            </div>
            <p className="text-[40px] font-extrabold leading-none">{kwh.toFixed(1)}</p>
            <p className="text-[13px] text-text-soft">{t('kWh delivered')}</p>
          </div>
        </div>

        {/* Charger went quiet mid-session — don't keep implying it's still charging. */}
        {active && stale && (
          <Banner tone="warn">
            {t("We haven't had a fresh reading from this charger in a while — it may have lost connection and your session may have stopped. Try Refresh status, or tap Stop charging.")}
          </Banner>
        )}

        {/* Live EV battery — only when the charger reports the OCPP SoC measurand */}
        {active && soc != null && (
          <Card>
            <div className="mb-2 flex items-end justify-between">
              <p className="flex items-center gap-2 text-[14px] font-semibold">
                <BatteryIcon className="h-5 w-5 text-volt" /> {t('Battery')}
              </p>
              <p className="text-[26px] font-extrabold leading-none text-volt">{Math.round(soc)}<span className="text-[15px]">%</span></p>
            </div>
            <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-card-2">
              <div
                className="h-full rounded-full bg-volt transition-[width] duration-700"
                style={{ width: `${Math.max(3, Math.min(100, soc))}%` }}
              />
              {socLimit != null && (
                <span
                  className="absolute top-[-3px] h-[20px] w-[2px] bg-amber"
                  style={{ left: `${socLimit}%` }}
                  aria-hidden
                />
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-text-soft">
              {socLimit != null
                ? `${t('Auto-stops at')} ${socLimit}%`
                : soc >= 80
                  ? t('Nearly full — charging may slow to protect the battery.')
                  : t('Reported live by the charger.')}
            </p>

            {/* Charge limit — auto-stop at a target % (Tesla/ChargePoint style) */}
            <div className="mt-3 border-t border-line pt-3">
              <p className="mb-2 text-[12px] font-medium text-text-soft">{t('Charge limit')}</p>
              <div className="flex gap-2">
                {([null, 70, 80, 90, 100] as const).map((opt) => {
                  const selected = socLimit === opt;
                  return (
                    <button
                      key={opt ?? 'off'}
                      onClick={() => { autoStopped.current = false; setSocLimit(opt); }}
                      className={`flex-1 rounded-xl py-2 text-[12.5px] font-semibold transition ${selected ? 'bg-volt text-ink' : 'border border-line text-text-soft'}`}
                    >
                      {opt == null ? t('No limit') : `${opt}%`}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {!active && (
          <Banner tone="info">{t('No active session. Start one from a charger — your live energy, power, and cost will appear here.')}</Banner>
        )}

        {/* Live stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center"><p className="text-[18px] font-bold">{power.toFixed(1)}</p><p className="text-[11px] text-text-soft">{t('kW now')}</p></Card>
          <Card className="text-center"><p className="text-[18px] font-bold tabular-nums">{elapsed}</p><p className="text-[11px] text-text-soft">{t('elapsed')}</p></Card>
          <Card className="text-center"><p className="text-[18px] font-bold">{money(session?.total ?? session?.cost ?? 0, session?.currency)}</p><p className="text-[11px] text-text-soft">{t('cost')}</p></Card>
        </div>

        {/* Live charging power curve */}
        {active && (
          <Card>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[14px] font-semibold">{t('Charging power')}</p>
              <div className="flex items-center gap-3 text-[11px] text-text-soft">
                <span>{t('peak')} <b className="text-text">{peakKw.toFixed(1)}</b> kW</span>
                <span>{t('avg')} <b className="text-text">{avgKw.toFixed(1)}</b> kW</span>
              </div>
            </div>
            <PowerCurve points={history} emptyLabel={t('Gathering live power…')} />
          </Card>
        )}

        {/* Charge goal — pick a target, watch the live time-to-target */}
        {active && (
          <Card>
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-[14px] font-semibold">{t('Charge goal')}</p>
              {goalReached ? (
                <span className="rounded-full bg-volt/15 px-2.5 py-1 text-[12px] font-bold text-volt">{t('Goal reached')} ✓</span>
              ) : etaMin != null ? (
                <span className="text-[12px] text-text-soft"><b className="text-text">~{etaMin}</b> {t('min left')}</span>
              ) : null}
            </div>
            <div className="flex gap-2">
              {([null, 5, 10, 20, 40] as const).map((g) => (
                <button
                  key={g ?? 'off'}
                  onClick={() => setGoalKwh(g)}
                  className={`flex-1 rounded-xl py-2 text-[12px] font-semibold transition ${goalKwh === g ? 'bg-volt text-ink' : 'border border-line text-text-soft'}`}
                >
                  {g == null ? t('Off') : g}
                </button>
              ))}
            </div>
            {goalKwh != null && (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-volt transition-all" style={{ width: `${goalPct}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-text-faint">
                  <span>{kwh.toFixed(1)} kWh</span>
                  <span>{t('Goal')} {goalKwh} kWh</span>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Charging speed limit — hidden when SmartCharging is disabled for the network (inert otherwise) */}
        {!smartChargingOff && (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[14px] font-semibold">{t('Charging speed')}</p>
            <div className="flex items-center gap-2.5">
              {limit < MAX_AMPS && <button type="button" onClick={clearLimit} className="text-[12px] font-medium text-volt">{t('Clear')}</button>}
              <span className="rounded-full bg-volt/10 px-2.5 py-1 text-[12px] font-bold text-volt">{limit} A</span>
            </div>
          </div>
          <input
            type="range"
            min={MIN_AMPS}
            max={MAX_AMPS}
            step={1}
            value={limit}
            onChange={(e) => changeLimit(Number(e.target.value))}
            aria-label="Charging speed in amps"
            aria-valuetext={`${limit} amps`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-volt"
          />
          <div className="mt-1 flex justify-between text-[11px] text-text-faint"><span>{t('Eco · 6 A')}</span><span>{t('Max · 32 A')}</span></div>
          {limitMsg && <p className="mt-2 text-[12px] text-volt">{limitMsg}</p>}
        </Card>
        )}

        {note && <Banner tone="warn">{note}</Banner>}

        {/* Charger self-service: unlock the cable + ask the charger to re-send live status. */}
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" onClick={unlockCable} disabled={!chargerId}><PlugIcon className="h-4 w-4" /> {t('Unlock cable')}</Button>
          <Button variant="outline" onClick={refreshStatus} disabled={!chargerId}><BoltIcon className="h-4 w-4" /> {t('Refresh status')}</Button>
        </div>

        <Button variant="danger" onClick={stop} loading={stopping} disabled={!active}>
          <PowerIcon className="h-5 w-5" /> {t('Stop charging')}
        </Button>
      </div>
    </div>
  );
}
