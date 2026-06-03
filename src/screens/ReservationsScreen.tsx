import { useState } from 'react';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { Card, EmptyState, Spinner, StatusPill, Banner, Button, useAsync } from '../components/ui.tsx';
import { ClockIcon } from '../components/icons.tsx';
import { asArray, type Reservation } from '../lib/types.ts';
import { useT } from '../lib/i18n.tsx';

interface Sched { id: string; connectorNumber?: number; scheduledTime?: string; status?: string; statusReason?: string }

interface ReservationDetail { chargerId?: string; chargerName?: string; idTag?: string; createdAt?: string; statusReason?: string }

export function ReservationsScreen() {
  const { client } = usePhevnix();
  const { t } = useT();
  const [cancelling, setCancelling] = useState<string | null>(null);
  // GET /emsp/v1/reservations/{id} — lazily fetched the first time a card is expanded.
  const [detail, setDetail] = useState<Record<string, ReservationDetail | 'loading'>>({});
  const list = useAsync(async () => asArray<Reservation>(await client.listReservations({ pageSize: 50 })), []);
  const sched = useAsync(async () => asArray<Sched>(await client.listScheduledCharges()), []);

  async function toggleDetail(id: string) {
    if (detail[id]) { setDetail((d) => { const { [id]: _, ...rest } = d; return rest; }); return; }
    setDetail((d) => ({ ...d, [id]: 'loading' }));
    try {
      const r = (await client.getReservation(id)) as ReservationDetail;
      setDetail((d) => ({ ...d, [id]: r }));
    } catch {
      setDetail((d) => { const { [id]: _, ...rest } = d; return rest; });
    }
  }

  async function cancel(id: string) {
    setCancelling(id);
    try {
      await client.cancelReservation(id);
      list.reload();
    } finally {
      setCancelling(null);
    }
  }

  async function cancelSched(id: string) {
    setCancelling(id);
    try {
      await client.cancelScheduledCharge(id);
      sched.reload();
    } finally {
      setCancelling(null);
    }
  }

  const active = (r: Reservation) => !['Cancelled', 'Expired'].includes(r.status);
  const schedList = (sched.data ?? []).filter((s) => s.status !== 'Cancelled');

  return (
    <div>
      <ScreenHeader title={t('Reservations')} subtitle={t('Connectors you’ve held for later')} />
      <div className="space-y-3 px-5 py-5">
        {/* Scheduled charges */}
        {schedList.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-faint">{t('Scheduled charges')}</h2>
            {schedList.map((s) => (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14.5px] font-semibold">{t('Connector')} {s.connectorNumber}</p>
                    <p className="mt-0.5 text-[12px] text-text-soft">{t('Starts')} {s.scheduledTime ? new Date(s.scheduledTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</p>
                    {s.status === 'Failed' && s.statusReason && <p className="mt-0.5 text-[11px] text-rose">{s.statusReason}</p>}
                  </div>
                  <StatusPill status={s.status ?? 'Pending'} />
                </div>
                {s.status === 'Pending' && (
                  <div className="mt-3">
                    <Button variant="outline" loading={cancelling === s.id} onClick={() => cancelSched(s.id)} className="h-10">{t('Cancel')}</Button>
                  </div>
                )}
              </Card>
            ))}
          </section>
        )}

        {list.loading && <div className="flex justify-center py-16 text-volt"><Spinner className="h-7 w-7" /></div>}
        {list.featureDisabled && <Banner tone="warn">{t('Reservations aren’t enabled by your provider.')}</Banner>}
        {list.error && <Banner tone="warn">{list.error}</Banner>}
        {!list.loading && !list.featureDisabled && (list.data?.length ?? 0) === 0 && (
          <EmptyState icon={<ClockIcon className="h-9 w-9" />} title={t('No reservations')} subtitle={t('Reserve a connector from a charger and it’ll show up here.')} />
        )}

        {list.data?.map((r) => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14.5px] font-semibold">{r.chargerName ? `${r.chargerName} · ` : ''}{t('Connector')} {r.connectorNumber}</p>
                <p className="mt-0.5 text-[12px] text-text-soft">{t('Hold expires')} {new Date(r.expiryDate).toLocaleString()}</p>
                <p className="mt-0.5 text-[11px] text-text-faint">{t('Tag')} {r.idTag}</p>
              </div>
              <StatusPill status={r.status} />
            </div>
            {detail[r.id] && detail[r.id] !== 'loading' && (
              <div className="mt-3 space-y-1 border-t border-line pt-3 text-[12px] text-text-soft">
                {((detail[r.id] as ReservationDetail).chargerName || (detail[r.id] as ReservationDetail).chargerId) && (
                  <p>{t('Charger')} <span className={(detail[r.id] as ReservationDetail).chargerName ? 'font-semibold text-text' : 'font-mono text-text'}>{(detail[r.id] as ReservationDetail).chargerName ?? (detail[r.id] as ReservationDetail).chargerId}</span></p>
                )}
                {(detail[r.id] as ReservationDetail).createdAt && <p>{t('Reserved')} {new Date((detail[r.id] as ReservationDetail).createdAt!).toLocaleString()}</p>}
                {(detail[r.id] as ReservationDetail).statusReason && <p className="text-rose">{(detail[r.id] as ReservationDetail).statusReason}</p>}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" onClick={() => toggleDetail(r.id)} loading={detail[r.id] === 'loading'} className="h-10">
                {detail[r.id] && detail[r.id] !== 'loading' ? t('Hide details') : t('View details')}
              </Button>
              {active(r) && (
                <Button variant="outline" loading={cancelling === r.id} onClick={() => cancel(r.id)} className="h-10">{t('Cancel reservation')}</Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
