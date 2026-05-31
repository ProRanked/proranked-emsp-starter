import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { Card, Spinner, Banner, StatusPill, Button, useAsync, money } from '../components/ui.tsx';
import { ChevronLeft, BoltIcon, ReceiptIcon } from '../components/icons.tsx';
import type { ChargingSessionDetail } from '../lib/types.ts';

/** Itemized receipt for one session — the trust artifact every pro charging app has. */
export function ReceiptScreen() {
  const { id = '' } = useParams();
  const { client } = usePhevnix();
  const navigate = useNavigate();
  const [note, setNote] = useState<string | null>(null);

  const detail = useAsync(() => client.getSession(id) as Promise<ChargingSessionDetail>, [id]);
  const s = detail.data;

  const currency = s?.costs?.currency ?? s?.currency ?? 'USD';
  const total = s?.costs?.total ?? s?.total ?? s?.cost ?? 0;
  const start = s?.startTime ? new Date(s.startTime) : null;
  const end = s?.endTime ? new Date(s.endTime) : null;
  const mins = s?.durationSeconds != null ? Math.round(s.durationSeconds / 60) : null;

  async function share() {
    if (!s) return;
    const lines = [
      `Voltway charging receipt`,
      `${s.locationName ?? s.chargerUid ?? 'Charger'} — ${start ? start.toLocaleString() : ''}`,
      `${(s.energyDeliveredKwh ?? 0).toFixed(2)} kWh · ${mins ?? 0} min`,
      `Total ${money(total, currency)}`,
    ].join('\n');
    try {
      if (navigator.share) await navigator.share({ title: 'Charging receipt', text: lines });
      else { await navigator.clipboard.writeText(lines); setNote('Receipt copied to clipboard.'); }
    } catch {
      /* user cancelled share — no-op */
    }
  }

  const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <div className={`flex items-center justify-between ${strong ? 'text-[15px] font-bold' : 'text-[13px]'}`}>
      <span className={strong ? '' : 'text-text-soft'}>{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <div>
      <ScreenHeader
        title="Receipt"
        back={<button aria-label="Go back" onClick={() => navigate(-1)} className="-ml-1 text-text-soft"><ChevronLeft className="h-6 w-6" /></button>}
        action={!detail.loading && s ? <StatusPill status={s.status} /> : undefined}
      />

      <div className="space-y-5 px-5 py-5">
        {detail.loading && <div className="flex justify-center py-16 text-volt"><Spinner className="h-7 w-7" /></div>}
        {detail.error && <Banner tone="warn">{detail.error}</Banner>}

        {!detail.loading && s && (
          <>
            {/* Hero total */}
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-volt/15 text-volt"><ReceiptIcon className="h-6 w-6" /></div>
              <p className="text-[40px] font-extrabold leading-none">{money(total, currency)}</p>
              <p className="mt-1 text-[13px] text-text-soft">{s.locationName ?? s.chargerUid ?? 'Charging session'}</p>
            </div>

            {/* Session facts */}
            <Card>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-[16px] font-bold text-volt">{(s.energyDeliveredKwh ?? 0).toFixed(1)}</p><p className="text-[11px] text-text-soft">kWh</p></div>
                <div><p className="text-[16px] font-bold">{mins ?? 0}</p><p className="text-[11px] text-text-soft">minutes</p></div>
                <div><p className="text-[16px] font-bold">{s.maxPowerKw != null ? s.maxPowerKw.toFixed(0) : '—'}</p><p className="text-[11px] text-text-soft">peak kW</p></div>
              </div>
            </Card>

            {/* Detail rows */}
            <Card className="space-y-2">
              {start && <Row label="Started" value={start.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} />}
              {end && <Row label="Ended" value={end.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} />}
              <Row label="Charger" value={s.chargerUid ?? '—'} />
              {s.connectorNumber != null && <Row label="Connector" value={`#${s.connectorNumber}`} />}
              {s.authMethod && <Row label="Authorized via" value={s.authMethod} />}
              {s.idleTimeSeconds != null && s.idleTimeSeconds > 0 && <Row label="Idle time" value={`${Math.round(s.idleTimeSeconds / 60)} min`} />}
            </Card>

            {/* Itemized cost breakdown */}
            <Card className="space-y-2.5">
              <p className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-text-soft"><BoltIcon className="h-4 w-4 text-volt" /> Charges</p>
              <Row label="Energy" value={money(s.costs?.subtotal ?? total, currency)} />
              {s.costs?.sessionFees != null && s.costs.sessionFees > 0 && <Row label="Session fee" value={money(s.costs.sessionFees, currency)} />}
              {s.costs?.idleFees != null && s.costs.idleFees > 0 && <Row label="Idle fee" value={money(s.costs.idleFees, currency)} />}
              {s.costs?.taxes != null && s.costs.taxes > 0 && <Row label="Taxes" value={money(s.costs.taxes, currency)} />}
              <div className="my-1 border-t border-line" />
              <Row label="Total" value={money(total, currency)} strong />
            </Card>

            {note && <Banner tone="volt">{note}</Banner>}
            <Button variant="outline" onClick={share}><ReceiptIcon className="h-5 w-5" /> Share receipt</Button>
          </>
        )}
      </div>
    </div>
  );
}
