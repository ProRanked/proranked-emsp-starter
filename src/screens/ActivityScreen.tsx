import { useNavigate } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { Card, EmptyState, SkeletonList, StatusPill, ErrorState, useAsync, money } from '../components/ui.tsx';
import { BoltIcon, ReceiptIcon, ChevronRight, LeafIcon } from '../components/icons.tsx';
import { asArray, type ChargingSession } from '../lib/types.ts';
import { useT } from '../lib/i18n.tsx';

/** Charging history — every past + active session, newest first, tap for a receipt. */
export function ActivityScreen() {
  const { client } = usePhevnix();
  const navigate = useNavigate();
  const { t } = useT();
  const list = useAsync(
    async () => asArray<ChargingSession>(await client.listSessions({ pageSize: 100 })),
    [],
  );

  const sessions = [...(list.data ?? [])].sort(
    (a, b) => new Date(b.startTime ?? 0).getTime() - new Date(a.startTime ?? 0).getTime(),
  );

  const totalKwh = sessions.reduce((s, x) => s + (x.energyDeliveredKwh ?? 0), 0);
  const totalSpent = sessions.reduce((s, x) => s + (x.total ?? x.cost ?? 0), 0);
  const currency = sessions.find((s) => s.currency)?.currency ?? 'USD';

  return (
    <div>
      <ScreenHeader title={t('Activity')} subtitle={t('Your charging history & receipts')} />
      <div className="space-y-3 px-5 py-5">
        {list.loading && <SkeletonList rows={4} />}
        {list.error && <ErrorState message={list.error} onRetry={list.reload} />}

        {!list.loading && !list.error && sessions.length === 0 && (
          <EmptyState icon={<ReceiptIcon className="h-9 w-9" />} title={t('No charges yet')} subtitle={t('Start a session and it’ll appear here with a full receipt.')} />
        )}

        {/* Lifetime summary */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="text-center"><p className="text-[18px] font-bold">{sessions.length}</p><p className="text-[11px] text-text-soft">{t('sessions')}</p></Card>
            <Card className="text-center"><p className="text-[18px] font-bold">{totalKwh.toFixed(1)}</p><p className="text-[11px] text-text-soft">{t('kWh total')}</p></Card>
            <Card className="text-center"><p className="text-[18px] font-bold">{money(totalSpent, currency)}</p><p className="text-[11px] text-text-soft">{t('spent')}</p></Card>
          </div>
        )}

        {/* Insights entry */}
        {sessions.length > 0 && (
          <Card onClick={() => navigate('/insights')} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-volt/10 text-volt"><LeafIcon className="h-5 w-5" /></div>
              <div>
                <p className="text-[14px] font-semibold">{t('Charging insights')}</p>
                <p className="text-[12px] text-text-soft">{t('CO₂ avoided, trends & top stations')}</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-text-faint" />
          </Card>
        )}

        {sessions.map((s) => {
          const kwh = s.energyDeliveredKwh ?? 0;
          const amount = s.total ?? s.cost ?? 0;
          const when = s.startTime ? new Date(s.startTime) : null;
          const mins = s.durationSeconds != null ? Math.round(s.durationSeconds / 60) : null;
          return (
            <Card key={s.id} onClick={() => s.id && navigate(`/activity/${s.id}`)}>
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-volt/10 text-volt">
                  <BoltIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[14.5px] font-semibold">{s.locationName ?? s.chargerUid ?? t('Charging session')}</p>
                    <StatusPill status={s.status} />
                  </div>
                  <div className="mt-1 flex items-center gap-2.5 text-[12px] text-text-soft">
                    <span>{kwh.toFixed(1)} kWh</span>
                    {mins != null && <span>· {mins} {t('min')}</span>}
                    <span className="font-semibold text-text">· {money(amount, s.currency)}</span>
                  </div>
                  {when && <p className="mt-0.5 text-[11px] text-text-faint">{when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</p>}
                </div>
                <ChevronRight className="h-5 w-5 text-text-faint" />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
