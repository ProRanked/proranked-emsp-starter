import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { Card, EmptyState, Spinner, Banner } from '../components/ui.tsx';
import { BoltIcon, SearchIcon, PinIcon, ChevronRight } from '../components/icons.tsx';
import { asArray, type LocationLite } from '../lib/types.ts';

// San Juan, PR — a sensible default origin for the demo network.
const ORIGIN = { lat: 18.4248, lng: -66.0758 };

export function HomeScreen() {
  const { client, driver, activeSession } = usePhevnix();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [locations, setLocations] = useState<LocationLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load nearby locations; fall back to the full list if geo-search is empty.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let rows = asArray<LocationLite>(await client.searchLocations(ORIGIN.lat, ORIGIN.lng, 250, 50));
        if (rows.length === 0) rows = asArray<LocationLite>(await client.listLocations({ pageSize: 50 }));
        if (alive) setLocations(rows);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [client]);

  const filtered = query
    ? locations.filter((l) => `${l.name ?? ''} ${l.address ?? ''} ${l.city ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    : locations;

  return (
    <div>
      {/* Greeting */}
      <div className="px-5 pt-6">
        <p className="text-[13px] text-text-soft">Good to see you,</p>
        <h1 className="text-[26px] font-extrabold tracking-tight">{driver?.firstName ?? 'Driver'} ⚡</h1>
      </div>

      {/* Search */}
      <div className="px-5 pt-4">
        <div className="flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-ink-soft px-4">
          <SearchIcon className="h-5 w-5 text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, city, address"
            className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-text-faint"
          />
        </div>
      </div>

      {/* Active charging session — resume from anywhere in the app */}
      {activeSession && (
        <div className="px-5 pt-4">
          <button
            onClick={() => navigate('/session')}
            className="flex w-full items-center gap-3.5 rounded-2xl border border-volt/40 bg-volt/10 p-3.5 text-left"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-volt/15 text-volt">
              <BoltIcon className="h-6 w-6 animate-pulse-volt" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-volt">Charging in progress</p>
              <p className="truncate text-[12.5px] text-text-soft">
                {(activeSession.energyDeliveredKwh ?? 0).toFixed(1)} kWh delivered · tap to view &amp; stop
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-volt" />
          </button>
        </div>
      )}

      {/* Faux map banner with nearby pins */}
      <div className="px-5 pt-4">
        <MapBanner count={filtered.length} locations={filtered} />
      </div>

      {/* List */}
      <div className="px-5 pb-6 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold">Chargers near you</h2>
          <span className="text-[12px] text-text-soft">{filtered.length} {filtered.length === 1 ? 'site' : 'sites'}</span>
        </div>

        {loading && (
          <div className="flex justify-center py-16 text-volt"><Spinner className="h-7 w-7" /></div>
        )}
        {error && !loading && <Banner tone="warn">Couldn’t load locations: {error}</Banner>}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState icon={<PinIcon className="h-9 w-9" />} title="No charging sites yet" subtitle="This network hasn’t published any public locations." />
        )}

        <div className="space-y-3">
          {filtered.map((loc) => (
            <Card key={loc.id} onClick={() => navigate(`/location/${loc.id}`)}>
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-volt/10 text-volt">
                  <BoltIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{loc.name ?? 'Charging site'}</p>
                  <p className="truncate text-[12.5px] text-text-soft">
                    {[loc.address, loc.city].filter(Boolean).join(', ') || 'Address unavailable'}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-text-faint">
                    {loc.distanceKm != null && <span>{loc.distanceKm.toFixed(1)} km away</span>}
                    {loc.chargerCount != null && <span>· {loc.chargerCount} chargers</span>}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-text-faint" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function MapBanner({ count, locations }: { count: number; locations: LocationLite[] }) {
  // Pins positioned by relative lat/lng within the visible set (purely decorative).
  const pts = locations.filter((l) => l.latitude != null && l.longitude != null).slice(0, 12);
  const lats = pts.map((p) => p.latitude!);
  const lngs = pts.map((p) => p.longitude!);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const pos = (p: LocationLite) => ({
    left: `${10 + (lngs.length > 1 ? ((p.longitude! - minLng) / (maxLng - minLng || 1)) * 80 : 50)}%`,
    top: `${15 + (lats.length > 1 ? (1 - (p.latitude! - minLat) / (maxLat - minLat || 1)) * 65 : 40)}%`,
  });
  return (
    <div className="relative h-40 overflow-hidden rounded-3xl border border-line">
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_-20%,rgba(46,230,166,0.18),transparent_55%)] bg-card-2" />
      <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: 'linear-gradient(#2a2a3a 1px, transparent 1px), linear-gradient(90deg, #2a2a3a 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      {/* user dot */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="absolute -inset-3 animate-pulse-volt rounded-full bg-volt/20" />
        <span className="relative block h-3 w-3 rounded-full bg-volt ring-4 ring-volt/20" />
      </div>
      {pts.map((p) => (
        <div key={p.id} className="absolute -translate-x-1/2 -translate-y-full text-volt" style={pos(p)}>
          <PinIcon className="h-5 w-5 drop-shadow" />
        </div>
      ))}
      <div className="absolute bottom-3 left-4 rounded-full bg-ink/70 px-3 py-1 text-[11px] font-medium text-text-soft backdrop-blur">
        {count} sites in range
      </div>
    </div>
  );
}
