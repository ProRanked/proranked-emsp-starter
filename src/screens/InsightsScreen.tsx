import { useNavigate } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { Card, SkeletonList, EmptyState, ErrorState, useAsync, money } from '../components/ui.tsx';
import { ChevronLeft, BoltIcon, LeafIcon, PinIcon } from '../components/icons.tsx';
import { asArray, type ChargingSession } from '../lib/types.ts';
import { useT } from '../lib/i18n.tsx';

// Conservative, transparent estimate of CO₂ avoided vs. an average gasoline car,
// net of typical grid emissions. Labeled as an estimate in the UI.
const KG_CO2_PER_KWH = 0.35;

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

/** "Your charging impact" — the analytics view premium charging apps ship. All derived
 *  client-side from the driver's own session history (GET /emsp/v1/sessions). */
export function InsightsScreen() {
  const { client } = usePhevnix();
  const navigate = useNavigate();
  const { t, lang } = useT();
  const list = useAsync(async () => asArray<ChargingSession>(await client.listSessions({ pageSize: 200 })), []);

  const sessions = (list.data ?? []).filter((s) => (s.energyDeliveredKwh ?? 0) > 0 || (s.total ?? s.cost ?? 0) > 0);
  const totalKwh = sessions.reduce((a, s) => a + (s.energyDeliveredKwh ?? 0), 0);
  const totalSpent = sessions.reduce((a, s) => a + (s.total ?? s.cost ?? 0), 0);
  const currency = sessions.find((s) => s.currency)?.currency ?? 'USD';
  const co2 = totalKwh * KG_CO2_PER_KWH;
  const avgKwh = sessions.length ? totalKwh / sessions.length : 0;
  const avgPerKwh = totalKwh > 0 ? totalSpent / totalKwh : 0;

  // Last 6 calendar months of energy, oldest→newest.
  const now = new Date();
  const months: { key: string; label: string; kwh: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: d.toLocaleDateString(lang === 'es' ? 'es' : 'en', { month: 'short' }), kwh: 0 });
  }
  for (const s of sessions) {
    if (!s.startTime) continue;
    const k = monthKey(new Date(s.startTime));
    const m = months.find((x) => x.key === k);
    if (m) m.kwh += s.energyDeliveredKwh ?? 0;
  }
  const peakMonth = Math.max(1, ...months.map((m) => m.kwh));

  // Top stations by energy.
  const byStation = new Map<string, { name: string; kwh: number; count: number }>();
  for (const s of sessions) {
    const name = s.locationName ?? s.chargerUid ?? t('Charging session');
    const cur = byStation.get(name) ?? { name, kwh: 0, count: 0 };
    cur.kwh += s.energyDeliveredKwh ?? 0;
    cur.count += 1;
    byStation.set(name, cur);
  }
  const topStations = [...byStation.values()].sort((a, b) => b.kwh - a.kwh).slice(0, 3);

  return (
    <div>
      <ScreenHeader
        title={t('Insights')}
        subtitle={t('Your charging impact')}
        back={<button aria-label="Go back" onClick={() => navigate('/activity')} className="-ml-1 text-text-soft"><ChevronLeft className="h-6 w-6" /></button>}
      />
      <div className="space-y-5 px-5 py-5">
        {list.loading && <SkeletonList rows={4} />}
        {list.error && <ErrorState message={list.error} onRetry={list.reload} />}

        {!list.loading && !list.error && sessions.length === 0 && (
          <EmptyState icon={<LeafIcon className="h-9 w-9" />} title={t('No impact yet')} subtitle={t('Charge a few times and your impact and trends will appear here.')} />
        )}

        {!list.loading && !list.error && sessions.length > 0 && (
          <>
            {/* CO₂ hero */}
            <Card className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-volt/15 text-volt"><LeafIcon className="h-6 w-6" /></div>
              <p className="text-[40px] font-extrabold leading-none text-volt">{co2.toFixed(1)}<span className="text-[18px]"> kg</span></p>
              <p className="mt-1 text-[13px] text-text-soft">{t('estimated CO₂ avoided vs. gasoline')}</p>
            </Card>

            {/* Headline stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="text-center"><p className="text-[18px] font-bold">{totalKwh.toFixed(0)}</p><p className="text-[11px] text-text-soft">{t('kWh total')}</p></Card>
              <Card className="text-center"><p className="text-[18px] font-bold">{sessions.length}</p><p className="text-[11px] text-text-soft">{t('sessions')}</p></Card>
              <Card className="text-center"><p className="text-[18px] font-bold">{money(totalSpent, currency)}</p><p className="text-[11px] text-text-soft">{t('spent')}</p></Card>
            </div>

            {/* Monthly energy trend */}
            <Card>
              <p className="mb-3 flex items-center gap-2 text-[14px] font-semibold"><BoltIcon className="h-4 w-4 text-volt" /> {t('Energy by month')}</p>
              <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
                {months.map((m) => (
                  <div key={m.key} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="text-[10px] font-semibold text-text-soft">{m.kwh > 0 ? m.kwh.toFixed(0) : ''}</span>
                    <div
                      className="w-full rounded-t-md bg-volt/80"
                      style={{ height: `${Math.max(m.kwh > 0 ? 6 : 0, (m.kwh / peakMonth) * 92)}px` }}
                    />
                    <span className="text-[10px] text-text-faint">{m.label}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Averages */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="text-center"><p className="text-[16px] font-bold">{avgKwh.toFixed(1)} kWh</p><p className="text-[11px] text-text-soft">{t('avg / session')}</p></Card>
              <Card className="text-center"><p className="text-[16px] font-bold">{money(avgPerKwh, currency)}</p><p className="text-[11px] text-text-soft">{t('avg / kWh')}</p></Card>
            </div>

            {/* Top stations */}
            {topStations.length > 0 && (
              <section>
                <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-text-faint">
                  <PinIcon className="h-4 w-4" /> {t('Most-used stations')}
                </h2>
                <Card className="divide-y divide-line p-0">
                  {topStations.map((st) => (
                    <div key={st.name} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0 pr-3">
                        <p className="truncate text-[14px] font-medium">{st.name}</p>
                        <p className="text-[12px] text-text-soft">{st.count} {st.count === 1 ? t('session') : t('sessions')}</p>
                      </div>
                      <p className="shrink-0 text-[14px] font-bold text-volt">{st.kwh.toFixed(1)} <span className="text-[11px] font-normal text-text-soft">kWh</span></p>
                    </div>
                  ))}
                </Card>
              </section>
            )}

            <p className="px-1 text-center text-[10px] text-text-faint">{t('CO₂ figure is an estimate for illustration, net of average grid emissions.')}</p>
          </>
        )}
      </div>
    </div>
  );
}
