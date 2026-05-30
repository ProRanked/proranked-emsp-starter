import { useState } from 'react';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { Card, EmptyState, Spinner, StatusPill, Banner, Button, useAsync } from '../components/ui.tsx';
import { ClockIcon } from '../components/icons.tsx';
import { asArray, type Reservation } from '../lib/types.ts';

export function ReservationsScreen() {
  const { client } = usePhevnix();
  const [cancelling, setCancelling] = useState<string | null>(null);
  const list = useAsync(async () => asArray<Reservation>(await client.listReservations({ pageSize: 50 })), []);

  async function cancel(id: string) {
    setCancelling(id);
    try {
      await client.cancelReservation(id);
      list.reload();
    } finally {
      setCancelling(null);
    }
  }

  const active = (r: Reservation) => !['Cancelled', 'Expired'].includes(r.status);

  return (
    <div>
      <ScreenHeader title="Reservations" subtitle="Connectors you’ve held for later" />
      <div className="space-y-3 px-5 py-5">
        {list.loading && <div className="flex justify-center py-16 text-volt"><Spinner className="h-7 w-7" /></div>}
        {list.featureDisabled && <Banner tone="warn">Reservations aren’t enabled by your provider.</Banner>}
        {list.error && <Banner tone="warn">{list.error}</Banner>}
        {!list.loading && !list.featureDisabled && (list.data?.length ?? 0) === 0 && (
          <EmptyState icon={<ClockIcon className="h-9 w-9" />} title="No reservations" subtitle="Reserve a connector from a charger and it’ll show up here." />
        )}

        {list.data?.map((r) => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14.5px] font-semibold">Connector {r.connectorNumber}</p>
                <p className="mt-0.5 text-[12px] text-text-soft">Hold expires {new Date(r.expiryDate).toLocaleString()}</p>
                <p className="mt-0.5 text-[11px] text-text-faint">Tag {r.idTag}</p>
              </div>
              <StatusPill status={r.status} />
            </div>
            {active(r) && (
              <div className="mt-3">
                <Button variant="outline" loading={cancelling === r.id} onClick={() => cancel(r.id)} className="h-10">Cancel reservation</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
