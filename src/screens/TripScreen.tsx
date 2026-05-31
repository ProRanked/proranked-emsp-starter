import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { LiveMap } from '../components/LiveMap.tsx';
import { Card, Button, Spinner, Banner } from '../components/ui.tsx';
import { ChevronLeft, ChevronRight, PinIcon, BoltIcon } from '../components/icons.tsx';
import { asArray, type LocationLite } from '../lib/types.ts';
import { geocode, planRoute, distToRouteKm, isValidLatLng, type LatLng, type RoutePlan } from '../lib/geo.ts';
import { useT } from '../lib/i18n.tsx';

const ON_ROUTE_KM = 6; // a charger is "on your route" within this corridor

interface OnRoute extends LocationLite { detourKm: number }

/** Trip planner — route to a destination and surface the charging stops along the way.
 *  Routing via the keyless public OSRM server; chargers via the eMSP locations API. */
export function TripScreen() {
  const { client } = usePhevnix();
  const navigate = useNavigate();
  const { t } = useT();

  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [onRoute, setOnRoute] = useState<OnRoute[]>([]);

  // Prefill the origin with the device location when granted.
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => { setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }); setFrom(t('Current location')); },
      () => {/* denied/unavailable — user can type a start */},
      { timeout: 5000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function plan(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true); setRoute(null); setOnRoute([]);
    try {
      const a = from && from !== t('Current location') ? await geocode(from) : origin;
      if (!a) { setError(t('Set a starting point.')); return; }
      const b = await geocode(to);
      if (!b) { setError(t('Couldn’t find that destination.')); return; }
      const plan = await planRoute(a, b);
      if (!plan || plan.coords.length < 2) { setError(t('No driving route found.')); return; }
      setRoute(plan);

      // Pull network sites near the route's midpoint, then keep those inside the corridor.
      const mid = plan.coords[Math.floor(plan.coords.length / 2)];
      const locs = asArray<LocationLite>(await client.searchLocations(mid[0], mid[1], 250, 50));
      const near = locs
        .filter((l) => isValidLatLng(l.latitude, l.longitude))
        .map((l) => ({ ...l, detourKm: distToRouteKm({ lat: l.latitude!, lng: l.longitude! }, plan.coords) }))
        .filter((l) => l.detourKm <= ON_ROUTE_KM)
        .sort((x, y) => x.detourKm - y.detourKm);
      setOnRoute(near);
    } catch {
      setError(t('Couldn’t plan that trip. Try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <ScreenHeader
        title={t('Plan a trip')}
        subtitle={t('Charging stops along your route')}
        back={<button aria-label="Go back" onClick={() => navigate('/')} className="-ml-1 text-text-soft"><ChevronLeft className="h-6 w-6" /></button>}
      />
      <div className="space-y-4 px-5 py-5">
        {/* From / To */}
        <Card>
          <form onSubmit={plan} className="space-y-2.5">
            <label className="flex items-center gap-2 rounded-xl border border-line px-3">
              <span className="text-[11px] font-semibold uppercase text-text-faint">{t('From')}</span>
              <input
                value={from} onChange={(e) => setFrom(e.target.value)}
                placeholder={t('Current location')}
                aria-label={t('From')}
                className="h-11 flex-1 bg-transparent text-[14px] outline-none placeholder:text-text-faint"
              />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-line px-3">
              <span className="text-[11px] font-semibold uppercase text-text-faint">{t('To')}</span>
              <input
                value={to} onChange={(e) => setTo(e.target.value)}
                placeholder={t('Destination city or address')}
                aria-label={t('To')}
                enterKeyHint="search"
                className="h-11 flex-1 bg-transparent text-[14px] outline-none placeholder:text-text-faint"
              />
            </label>
            <Button type="submit" loading={loading} disabled={!to.trim()}>
              <PinIcon className="h-5 w-5" /> {t('Plan trip')}
            </Button>
          </form>
        </Card>

        {error && <Banner tone="warn">{error}</Banner>}

        {loading && !route && (
          <div className="flex justify-center py-10 text-volt"><Spinner className="h-7 w-7" /></div>
        )}

        {route && (
          <>
            {/* Route summary */}
            <div className="flex items-center justify-around rounded-2xl bg-card-2 px-4 py-3 text-center">
              <div><p className="text-[16px] font-bold">{route.distanceKm.toFixed(0)} km</p><p className="text-[11px] text-text-soft">{t('distance')}</p></div>
              <div><p className="text-[16px] font-bold">{Math.round(route.durationMin)} {t('min')}</p><p className="text-[11px] text-text-soft">{t('drive time')}</p></div>
              <div><p className="text-[16px] font-bold text-volt">{onRoute.length}</p><p className="text-[11px] text-text-soft">{t('chargers')}</p></div>
            </div>

            {/* Map with route + chargers */}
            <LiveMap
              locations={onRoute}
              origin={origin ?? { lat: route.coords[0][0], lng: route.coords[0][1] }}
              route={route.coords}
              showUser={!!origin}
              onSelect={(id) => navigate(`/location/${id}`)}
              height={300}
            />

            {/* Chargers on route */}
            {onRoute.length === 0 ? (
              <Banner tone="info">{t('No charging stops within reach of this route.')}</Banner>
            ) : (
              <section className="space-y-2">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-faint">{t('Stops on your route')}</h2>
                {onRoute.map((l) => (
                  <Card key={l.id} onClick={() => navigate(`/location/${l.id}`)} className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-volt/10 text-volt"><BoltIcon className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-semibold">{l.name ?? t('Charging site')}</p>
                      <p className="truncate text-[12px] text-text-soft">
                        {[l.city, l.availableCount != null && l.chargerCount != null ? `${l.availableCount}/${l.chargerCount} ${t('available')}` : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[12.5px] font-semibold text-volt">{l.detourKm < 0.6 ? t('on route') : `${l.detourKm.toFixed(1)} km`}</p>
                      <ChevronRight className="ml-auto h-5 w-5 text-text-faint" />
                    </div>
                  </Card>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
