import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { Button, Card, Spinner, StatusPill, Banner, useAsync, money } from '../components/ui.tsx';
import { ChevronLeft, PlugIcon, BoltIcon, ClockIcon } from '../components/icons.tsx';
import { asArray, type Tariff } from '../lib/types.ts';

interface ChargerDetail {
  id: string;
  name?: string;
  serialNumber?: string;
  status?: string;
  manufacturer?: string;
  model?: string;
  maxPowerKw?: number;
  connectors?: { id?: string; connectorNumber?: number; status?: string; standard?: string; maxPowerKw?: number }[];
}

export function ChargerScreen() {
  const { id = '' } = useParams();
  const { client } = usePhevnix();
  const navigate = useNavigate();
  const [connector, setConnector] = useState(1);
  const [busy, setBusy] = useState<'start' | 'reserve' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'volt' | 'warn'; text: string } | null>(null);

  const charger = useAsync(() => client.getCharger(id) as Promise<ChargerDetail>, [id]);
  const tariffs = useAsync(async () => asArray<Tariff>(await client.listTariffs({ activeOnly: true, pageSize: 1 })), []);

  const c = charger.data;
  const conns = c?.connectors?.length ? c.connectors : [{ connectorNumber: 1, status: c?.status }];
  const tariff = tariffs.data?.[0];

  async function start() {
    setBusy('start');
    setMsg(null);
    try {
      const res = (await client.startCharging({ chargerId: id, connectorNumber: connector })) as { id?: string };
      sessionStorage.setItem('voltway.activeCharger', id);
      navigate('/session', { state: { sessionId: res?.id, chargerId: id, connector } });
    } catch (e) {
      setMsg({ tone: 'warn', text: errText(e) });
    } finally {
      setBusy(null);
    }
  }

  async function reserve() {
    setBusy('reserve');
    setMsg(null);
    try {
      await client.reserve({ chargerId: id, connectorNumber: connector, expiryMinutes: 15 });
      setMsg({ tone: 'volt', text: 'Connector reserved for 15 minutes. Head over and plug in.' });
    } catch (e) {
      setMsg({ tone: 'warn', text: errText(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <ScreenHeader
        title={c?.name ?? c?.serialNumber ?? 'Charger'}
        subtitle={c?.manufacturer ? `${c.manufacturer}${c.model ? ` · ${c.model}` : ''}` : undefined}
        back={<button onClick={() => navigate(-1)} className="-ml-1 text-text-soft"><ChevronLeft className="h-6 w-6" /></button>}
        action={charger.loading ? undefined : <StatusPill status={c?.status} />}
      />

      <div className="space-y-5 px-5 py-5">
        {charger.loading && <div className="flex justify-center py-12 text-volt"><Spinner className="h-7 w-7" /></div>}

        {!charger.loading && (
          <>
            {/* Power + tariff summary */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <div className="flex items-center gap-2 text-text-soft"><BoltIcon className="h-4 w-4 text-volt" /><span className="text-[12px]">Max power</span></div>
                <p className="mt-1 text-[22px] font-bold">{c?.maxPowerKw ?? conns[0]?.maxPowerKw ?? '—'}<span className="ml-1 text-[13px] font-medium text-text-soft">kW</span></p>
              </Card>
              <Card>
                <div className="flex items-center gap-2 text-text-soft"><ClockIcon className="h-4 w-4 text-volt" /><span className="text-[12px]">Energy rate</span></div>
                <p className="mt-1 text-[22px] font-bold">
                  {tariff?.isFree ? 'Free' : tariff?.energyRate != null ? money(tariff.energyRate, tariff.currency) : '—'}
                  {!tariff?.isFree && tariff?.energyRate != null && <span className="ml-1 text-[13px] font-medium text-text-soft">/kWh</span>}
                </p>
              </Card>
            </div>

            {/* Connector picker */}
            <div>
              <h2 className="mb-2.5 text-[15px] font-bold">Choose a connector</h2>
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
                        <p className="text-[14px] font-semibold">Connector {num}</p>
                        <p className="text-[12px] text-text-soft">{cn.standard ?? 'Type 2'}{cn.maxPowerKw ? ` · ${cn.maxPowerKw} kW` : ''}</p>
                      </div>
                      <StatusPill status={cn.status} />
                    </button>
                  );
                })}
              </div>
            </div>

            {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}

            {/* Actions */}
            <div className="space-y-2.5 pt-1">
              <Button onClick={start} loading={busy === 'start'}>
                <BoltIcon className="h-5 w-5" /> Start charging
              </Button>
              <Button variant="outline" onClick={reserve} loading={busy === 'reserve'}>
                <ClockIcon className="h-5 w-5" /> Reserve for 15 min
              </Button>
            </div>
            <p className="text-center text-[11px] text-text-faint">Billed to your Voltway account when the session ends.</p>
          </>
        )}
      </div>
    </div>
  );
}

function errText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/not available|UNKNOWN|INOPERATIVE/i.test(m)) return 'This charger is offline right now. Try another connector or site.';
  return m;
}
