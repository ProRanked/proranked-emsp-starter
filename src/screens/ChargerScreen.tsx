import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { Button, Card, Spinner, StatusPill, Banner, useAsync, money } from '../components/ui.tsx';
import { ChevronLeft, PlugIcon, BoltIcon, ClockIcon } from '../components/icons.tsx';
import { AddCardSheet } from '../components/PaymentMethods.tsx';
import { asArray, type Tariff } from '../lib/types.ts';
import { useT } from '../lib/i18n.tsx';
import { PhevnixApiError } from '../lib/phevnix.ts';

interface ChargerDetail {
  id: string;
  name?: string;
  serialNumber?: string;
  status?: string;
  manufacturer?: string;
  model?: string;
  maxPowerKw?: number;
  lastHeartbeat?: string;
  /** True only if the charger is actually reachable now (recent heartbeat). See CPO ChargerOnline. */
  isOnline?: boolean;
  connectors?: { id?: string; connectorNumber?: number; status?: string; standard?: string; maxPowerKw?: number }[];
}

export function ChargerScreen() {
  const { id = '' } = useParams();
  const { client, activeSession, refreshActiveSession } = usePhevnix();
  const navigate = useNavigate();
  const { t, lang } = useT();

  // Does the driver already have a live session on THIS charger? If so, the page
  // resumes it instead of offering a (doomed) second start on a busy connector.
  const sessionHere = activeSession && activeSession.chargerId === id ? activeSession : null;
  const [connector, setConnector] = useState(1);
  const [busy, setBusy] = useState<'start' | 'reserve' | 'schedule' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'volt' | 'warn'; text: string; action?: 'add-card' } | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [schedAt, setSchedAt] = useState('');

  const charger = useAsync(() => client.getCharger(id) as Promise<ChargerDetail>, [id]);
  const tariffs = useAsync(async () => asArray<Tariff>(await client.listTariffs({ activeOnly: true, pageSize: 1 })), []);

  // Pre-charge cost preview: POST /emsp/v1/pricing/calculate for a representative 20 kWh / 1 h charge.
  const tariffId = tariffs.data?.[0]?.id;
  const tariffFree = tariffs.data?.[0]?.isFree;
  const estimate = useAsync(
    async () => (tariffId && !tariffFree
      ? (client.estimateCost({ tariffId, energyKwh: 20, durationMinutes: 60 }) as Promise<{ total?: number; cost?: number; currency?: string }>)
      : null),
    [tariffId, tariffFree],
  );

  const [resetting, setResetting] = useState(false);
  async function resetCharger() {
    setResetting(true); setMsg(null);
    try {
      await client.resetCharger(id, 'Soft');
      setMsg({ tone: 'volt', text: t('Reset sent — the charger should reconnect shortly.') });
    } catch (e) {
      setMsg({ tone: 'warn', text: errText(e, t) });
    } finally {
      setResetting(false);
    }
  }

  const c = charger.data;
  const conns = c?.connectors?.length ? c.connectors : [{ connectorNumber: 1, status: c?.status }];
  const tariff = tariffs.data?.[0];
  // A charger's persisted status reads "AVAILABLE" even after its WebSocket drops, so trust the
  // API's connectivity flag (recent heartbeat). When offline, nothing is actually usable: show
  // "Offline" instead of the stale status and disable the start/reserve/schedule actions.
  const online = c?.isOnline ?? (c?.lastHeartbeat ? !!seenInfo(c.lastHeartbeat, lang)?.online : true);
  const displayStatus = (s?: string) => (online ? s : 'Offline');

  async function start() {
    setBusy('start');
    setMsg(null);
    try {
      const res = (await client.startCharging({ chargerId: id, connectorNumber: connector })) as { id?: string };
      sessionStorage.setItem('voltway.activeCharger', id);
      refreshActiveSession();
      navigate('/session', { state: { sessionId: res?.id, chargerId: id, connector } });
    } catch (e) {
      // A phevnix_managed network requires a saved card to charge. Surface a friendly message + an
      // "Add a card" CTA instead of the raw backend "driver has no default card" 402.
      if (isNoCardError(e)) {
        setMsg({ tone: 'warn', text: t('Add a payment method to start charging.'), action: 'add-card' });
      } else {
        setMsg({ tone: 'warn', text: errText(e, t) });
      }
    } finally {
      setBusy(null);
    }
  }

  async function reserve() {
    setBusy('reserve');
    setMsg(null);
    try {
      await client.reserve({ chargerId: id, connectorNumber: connector, expiryMinutes: 15 });
      setMsg({ tone: 'volt', text: t('Connector reserved for 15 minutes. Head over and plug in.') });
    } catch (e) {
      setMsg({ tone: 'warn', text: errText(e, t) });
    } finally {
      setBusy(null);
    }
  }

  async function schedule() {
    if (!schedAt) return;
    setBusy('schedule');
    setMsg(null);
    try {
      const when = new Date(schedAt);
      await client.scheduleCharge({ chargerId: id, connectorNumber: connector, scheduledTime: when.toISOString() });
      setScheduling(false);
      setSchedAt('');
      setMsg({ tone: 'volt', text: `${t('Scheduled to start')} ${when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.` });
    } catch (e) {
      setMsg({ tone: 'warn', text: errText(e, t) });
    } finally {
      setBusy(null);
    }
  }

  const fmtLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  // Default the picker to ~1 hour out; allow anything from now onward.
  function defaultSchedAt() { return fmtLocal(new Date(Date.now() + 60 * 60 * 1000)); }
  function nowLocal() { return fmtLocal(new Date()); }

  return (
    <div>
      <ScreenHeader
        title={c?.name ?? c?.serialNumber ?? t('Charger')}
        subtitle={c?.manufacturer ? `${c.manufacturer}${c.model ? ` · ${c.model}` : ''}` : undefined}
        back={<button aria-label="Go back" onClick={() => navigate(-1)} className="-ml-1 text-text-soft"><ChevronLeft className="h-6 w-6" /></button>}
        action={charger.loading ? undefined : <StatusPill status={displayStatus(c?.status)} />}
      />

      <div className="space-y-5 px-5 py-5">
        {charger.loading && <div className="flex justify-center py-12 text-volt"><Spinner className="h-7 w-7" /></div>}

        {!charger.loading && (
          <>
            {/* Power + tariff summary. Hide "Max power" when the rating is unknown rather than show a
                blank "— kW"; Energy rate then spans the full width. */}
            <div className={c?.maxPowerKw != null ? 'grid grid-cols-2 gap-3' : ''}>
              {c?.maxPowerKw != null && (
                <Card>
                  <div className="flex items-center gap-2 text-text-soft"><BoltIcon className="h-4 w-4 text-volt" /><span className="text-[12px]">{t('Max power')}</span></div>
                  <p className="mt-1 text-[22px] font-bold">{c.maxPowerKw}<span className="ml-1 text-[13px] font-medium text-text-soft">kW</span></p>
                </Card>
              )}
              <Card>
                <div className="flex items-center gap-2 text-text-soft"><ClockIcon className="h-4 w-4 text-volt" /><span className="text-[12px]">{t('Energy rate')}</span></div>
                <p className="mt-1 text-[22px] font-bold">
                  {tariff?.isFree ? t('Free') : tariff?.energyRate != null ? money(tariff.energyRate, tariff.currency) : '—'}
                  {!tariff?.isFree && tariff?.energyRate != null && <span className="ml-1 text-[13px] font-medium text-text-soft">/kWh</span>}
                </p>
              </Card>
            </div>

            {/* Online recency — the trust signal drivers care about most */}
            {(() => {
              const seen = seenInfo(c?.lastHeartbeat, lang);
              if (!seen) return null;
              return (
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className={`h-2 w-2 rounded-full ${seen.online ? 'bg-volt' : 'bg-amber'}`} />
                  <span className={seen.online ? 'text-text-soft' : 'text-amber'}>
                    {seen.online ? `${t('Online')} · ${seen.rel}` : `${t('Last seen')} ${seen.rel}`}
                  </span>
                </div>
              );
            })()}

            {/* Connector picker */}
            <div>
              <h2 className="mb-2.5 text-[15px] font-bold">{t('Choose a connector')}</h2>
              <div className="space-y-2.5">
                {conns.map((cn, i) => {
                  const num = cn.connectorNumber ?? i + 1;
                  const active = num === connector;
                  return (
                    <button
                      key={num}
                      onClick={() => setConnector(num)}
                      className={`flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition ${active ? 'border-volt bg-volt/5' : 'border-line bg-card'}`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-volt text-ink' : 'bg-card-2 text-volt'}`}>
                        <PlugIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[14px] font-semibold">{t('Connector')} {num}</p>
                        <p className="text-[12px] text-text-soft">{connectorLabel(cn.standard)}{cn.maxPowerKw ? ` · ${cn.maxPowerKw} kW` : ''}</p>
                      </div>
                      <StatusPill status={displayStatus(cn.status)} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pricing breakdown */}
            {tariff && (
              <div>
                <h2 className="mb-2.5 text-[15px] font-bold">{t('Pricing')}</h2>
                <Card className="space-y-2">
                  {tariff.isFree ? (
                    <div className="flex items-center justify-between text-[13px]"><span className="text-text-soft">{t('This charger is')}</span><span className="font-bold text-volt">{t('Free to use')}</span></div>
                  ) : (
                    <>
                      {tariff.energyRate != null && <PriceRow label={t('Energy')} value={`${money(tariff.energyRate, tariff.currency)} / kWh`} />}
                      {tariff.timeRate != null && tariff.timeRate > 0 && <PriceRow label={t('Time')} value={`${money(tariff.timeRate, tariff.currency)} / min`} />}
                      {tariff.sessionFee != null && tariff.sessionFee > 0 && <PriceRow label={t('Session fee')} value={money(tariff.sessionFee, tariff.currency)} />}
                      {tariff.idleRate != null && tariff.idleRate > 0 && <PriceRow label={t('Idle fee')} value={`${money(tariff.idleRate, tariff.currency)} / min`} />}
                      {(estimate.data?.total ?? estimate.data?.cost) != null && (
                        <>
                          <div className="my-1 border-t border-line" />
                          <PriceRow label={t('Est. 20 kWh · 1 h')} value={money((estimate.data!.total ?? estimate.data!.cost)!, estimate.data!.currency ?? tariff.currency)} />
                        </>
                      )}
                    </>
                  )}
                </Card>
              </div>
            )}

            {msg && (
              <Banner tone={msg.tone}>
                <div className="space-y-2">
                  <p>{msg.text}</p>
                  {msg.action === 'add-card' && !addingCard && (
                    <button
                      type="button"
                      onClick={() => setAddingCard(true)}
                      className="font-semibold text-volt underline"
                    >
                      {t('Add a card')}
                    </button>
                  )}
                </div>
              </Banner>
            )}

            {/* Add a card without leaving the start flow. Once saved (and set as default), retry the
                start automatically so the driver lands in the live session. */}
            {addingCard && (
              <Card className="space-y-3">
                <p className="text-[14px] font-semibold">{t('Add a payment method')}</p>
                <AddCardSheet
                  onAdded={() => { setAddingCard(false); setMsg(null); void start(); }}
                  onCancel={() => setAddingCard(false)}
                />
              </Card>
            )}

            {/* Actions */}
            {sessionHere ? (
              <div className="space-y-2.5 pt-1">
                <Banner tone="volt">
                  {t("You're charging here now")} — {(sessionHere.energyDeliveredKwh ?? 0).toFixed(1)} {t('kWh delivered')}.
                </Banner>
                <Button onClick={() => navigate('/session', { state: { sessionId: sessionHere.id, chargerId: id, connector: sessionHere.connectorNumber ?? connector } })}>
                  <BoltIcon className="h-5 w-5" /> {t('View live session')}
                </Button>
                {/* Remote reset is allowed only on a charger the driver is actively using (the eMSP API
                    enforces this — a driver can't reset chargers they don't have a live session on).
                    Surface it only when their own charger drops offline mid-session. */}
                {!online && (
                  <button type="button" onClick={resetCharger} disabled={resetting} className="block text-[12px] font-semibold text-volt underline disabled:opacity-50">
                    {resetting ? t('Sending reset…') : t('Charger offline? Try a remote reset')}
                  </button>
                )}
              </div>
            ) : (
              <>
                {!online && (
                  <Banner tone="warn">
                    {t('This charger is offline right now — it can’t start a session. Try another charger or site.')}
                  </Banner>
                )}
                <div className="space-y-2.5 pt-1">
                  <Button onClick={start} loading={busy === 'start'} disabled={!online}>
                    <BoltIcon className="h-5 w-5" /> {t('Start charging')}
                  </Button>
                  <Button variant="outline" onClick={reserve} loading={busy === 'reserve'} disabled={!online}>
                    <ClockIcon className="h-5 w-5" /> {t('Reserve for 15 min')}
                  </Button>

                  {scheduling ? (
                    <Card className="space-y-2.5">
                      <p className="flex items-center gap-2 text-[13px] font-semibold"><ClockIcon className="h-4 w-4 text-volt" /> {t('Schedule for later')}</p>
                      <input
                        type="datetime-local"
                        value={schedAt || defaultSchedAt()}
                        min={nowLocal()}
                        onChange={(e) => setSchedAt(e.target.value)}
                        aria-label={t('Start time')}
                        className="h-11 w-full rounded-xl border border-line bg-ink-soft px-3 text-[14px] outline-none"
                      />
                      <div className="flex gap-2">
                        <Button onClick={schedule} loading={busy === 'schedule'}>{t('Schedule charge')}</Button>
                        <Button variant="outline" onClick={() => setScheduling(false)}>{t('Cancel')}</Button>
                      </div>
                    </Card>
                  ) : (
                    <button onClick={() => { setScheduling(true); setSchedAt(defaultSchedAt()); }} className="w-full py-1 text-center text-[13px] font-medium text-volt">
                      {t('Schedule for later')}
                    </button>
                  )}
                </div>
                <p className="text-center text-[11px] text-text-faint">{t('Billed to your account when the session ends.')}</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-text-soft">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

/** Online-recency from the charger's last heartbeat — online if seen in the last 5 min. */
function seenInfo(iso: string | undefined, lang: string): { online: boolean; rel: string } | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const es = lang === 'es';
  let rel: string;
  if (s < 60) rel = es ? 'hace un momento' : 'just now';
  else if (s < 3600) { const n = Math.floor(s / 60); rel = es ? `hace ${n} min` : `${n} min ago`; }
  else if (s < 86400) { const n = Math.floor(s / 3600); rel = es ? `hace ${n} h` : `${n} h ago`; }
  else { const n = Math.floor(s / 86400); rel = es ? `hace ${n} d` : `${n} d ago`; }
  return { online: s < 300, rel };
}

/** Map raw OCPI/OCPP connector standards to friendly driver-facing names. */
function connectorLabel(standard?: string): string {
  if (!standard) return 'Type 2';
  const s = standard.toUpperCase();
  if (s.includes('T1_COMBO') || s === 'CCS1') return 'CCS1';
  if (s.includes('T2_COMBO') || s === 'CCS2' || s === 'CCS') return 'CCS';
  if (s.includes('CHADEMO')) return 'CHAdeMO';
  if (s.includes('T1') || s.includes('J1772')) return 'Type 1 (J1772)';
  if (s.includes('T2')) return 'Type 2';
  if (s.includes('TESLA')) return 'Tesla';
  if (s.includes('DOMESTIC')) return 'Wall plug';
  return standard.replace(/_/g, ' ');
}

/** True ONLY for the "no default card" 402 — NOT its sibling 402s (3DS payment_action_required,
 *  declined payment_failed), which keep their own accurate backend message via errText. */
function isNoCardError(e: unknown): boolean {
  if (e instanceof PhevnixApiError && e.errorCode === 'payment_method_required') return true;
  const m = e instanceof Error ? e.message : String(e);
  // Defense-in-depth for the raw backend message (a customer with no saved/default card).
  return /no (default|saved) card|payment method required/i.test(m);
}

function errText(e: unknown, t: (s: string) => string): string {
  const m = e instanceof Error ? e.message : String(e);
  // A busy/in-use connector is NOT the same as an offline charger — say so accurately.
  if (/CHARGING|OCCUPIED|PREPARING|FINISHING|in use|SuspendedEV/i.test(m))
    return t('This connector is in use right now. Try another connector or come back shortly.');
  if (/UNKNOWN|INOPERATIVE|offline|unreachable|not connected/i.test(m))
    return t('This charger is offline right now. Try another connector or site.');
  if (/RESERVED/i.test(m)) return t('This connector is reserved right now. Try another connector.');
  // Otherwise surface the API's own message — it's written for end users.
  return m;
}
