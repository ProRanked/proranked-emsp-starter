import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { Card, EmptyState, SkeletonList, Spinner, Banner } from '../components/ui.tsx';
import { BoltIcon, SearchIcon, PinIcon, ChevronRight } from '../components/icons.tsx';
import { LiveMap } from '../components/LiveMap.tsx';
import { asArray, type LocationLite } from '../lib/types.ts';

// San Juan, PR — a sensible default origin for the demo network.
const ORIGIN = { lat: 18.4248, lng: -66.0758 };

export function HomeScreen() {
  const { client, driver, activeSession } = usePhevnix();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [center, setCenter] = useState(ORIGIN);
  const [searching, setSearching] = useState(false);
  const [locations, setLocations] = useState<LocationLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load nearby locations for the current map center; fall back to the full list.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        let rows = asArray<LocationLite>(await client.searchLocations(center.lat, center.lng, 250, 50));
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
  }, [client, center]);

  // Geocode a typed place/address (OpenStreetMap Nominatim) and recenter the map.
  async function geocode() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (data[0]) {
        setCenter({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        setQuery(''); // show the full set for the new area
      } else {
        setError('No place found for that search.');
      }
    } catch {
      setError('Couldn’t reach the geocoder. Check your connection.');
    } finally {
      setSearching(false);
    }
  }

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
            onKeyDown={(e) => { if (e.key === 'Enter') geocode(); }}
            placeholder="Search a city or address…"
            enterKeyHint="search"
            className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-text-faint"
          />
          {searching && <Spinner className="h-4 w-4 text-volt" />}
        </div>
        {center !== ORIGIN && (
          <button onClick={() => { setCenter(ORIGIN); setQuery(''); }} className="mt-2 text-[12px] font-medium text-volt">
            ← Back to San Juan
          </button>
        )}
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

      {/* Live interactive station map */}
      <div className="px-5 pt-4">
        <LiveMap locations={filtered} origin={center} onSelect={(id) => navigate(`/location/${id}`)} />
      </div>

      {/* List */}
      <div className="px-5 pb-6 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold">Chargers near you</h2>
          <span className="text-[12px] text-text-soft">{filtered.length} {filtered.length === 1 ? 'site' : 'sites'}</span>
        </div>

        {loading && <SkeletonList rows={3} />}
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
