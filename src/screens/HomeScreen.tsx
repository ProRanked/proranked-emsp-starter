import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { Card, EmptyState, SkeletonList, Spinner, ErrorState } from '../components/ui.tsx';
import { BoltIcon, SearchIcon, PinIcon, ChevronRight } from '../components/icons.tsx';
import { LiveMap } from '../components/LiveMap.tsx';
import { asArray, type LocationLite } from '../lib/types.ts';
import { useT } from '../lib/i18n.tsx';

// San Juan, PR — a sensible default origin for the demo network.
const ORIGIN = { lat: 18.4248, lng: -66.0758 };

export function HomeScreen() {
  const { client, driver } = usePhevnix();
  const navigate = useNavigate();
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [center, setCenter] = useState(ORIGIN);
  const [searching, setSearching] = useState(false);
  const [locations, setLocations] = useState<LocationLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyFast, setOnlyFast] = useState(false);
  const [connFilter, setConnFilter] = useState<string | null>(null);
  const [amenity, setAmenity] = useState<'parking' | 'wifi' | 'restrooms' | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'available' | 'power' | 'rating'>('distance');
  const [code, setCode] = useState('');
  const [resolving, setResolving] = useState(false);

  // Scan-to-charge: resolve a charger by the code printed on it / behind its QR (its uid or EVSE id)
  // via GET /emsp/v1/chargers/{identifier}/info, then jump straight to that charger.
  async function resolveCode() {
    const c = code.trim();
    if (!c) return;
    setResolving(true); setError(null);
    try {
      // /info returns { chargerUuid, chargerUid, ... } — navigate by the GUID.
      const info = (await client.getChargerInfo(c)) as { chargerUuid?: string; id?: string; chargerId?: string; uuid?: string } | null;
      const id = info?.chargerUuid ?? info?.id ?? info?.chargerId ?? info?.uuid;
      if (id) navigate(`/charger/${id}`);
      else setError(t('No charger found for that code.'));
    } catch {
      setError(t('No charger found for that code.'));
    } finally {
      setResolving(false);
    }
  }

  // Connector categories present across the loaded sites (for filter chips).
  const categories = Array.from(
    new Set(locations.flatMap((l) => (l.connectorTypes ?? []).map(connectorCategory))),
  ).filter((c) => c !== 'Other').sort();

  // Load nearby locations for the current map center; fall back to the full list.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
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
  }, [client, center, reloadKey]);

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

  const filtered = locations
    .filter((l) => (query ? `${l.name ?? ''} ${l.address ?? ''} ${l.city ?? ''}`.toLowerCase().includes(query.toLowerCase()) : true))
    .filter((l) => (onlyAvailable ? (l.availableCount ?? 0) > 0 : true))
    .filter((l) => (onlyFast ? (l.maxPowerKw ?? 0) >= 50 : true))
    .filter((l) => (connFilter ? (l.connectorTypes ?? []).some((s) => connectorCategory(s) === connFilter) : true))
    .filter((l) => (amenity === 'parking' ? l.hasParking : amenity === 'wifi' ? l.hasWifi : amenity === 'restrooms' ? l.hasRestrooms : true))
    .sort((a, b) => {
      if (sortBy === 'available') return (b.availableCount ?? 0) - (a.availableCount ?? 0);
      if (sortBy === 'power') return (b.maxPowerKw ?? 0) - (a.maxPowerKw ?? 0);
      if (sortBy === 'rating') return (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0);
      return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity); // default: nearest
    });

  return (
    <div>
      {/* Greeting */}
      <div className="px-5 pt-6">
        <p className="text-[13px] text-text-soft">{t('Good to see you,')}</p>
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
            placeholder={t('Search a city or address…')}
            aria-label="Search for a city or address"
            enterKeyHint="search"
            className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-text-faint"
          />
          {searching && <Spinner className="h-4 w-4 text-volt" />}
        </div>
        {center !== ORIGIN && (
          <button onClick={() => { setCenter(ORIGIN); setQuery(''); }} className="mt-2 text-[12px] font-medium text-volt">
            {t('← Back to San Juan')}
          </button>
        )}
        <button
          onClick={() => navigate('/trip')}
          className="mt-3 flex w-full items-center justify-between rounded-2xl border border-line bg-ink-soft px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2.5">
            <PinIcon className="h-5 w-5 text-volt" />
            <span className="text-[14px] font-semibold">{t('Plan a trip')}</span>
            <span className="text-[12px] text-text-soft">{t('chargers along your route')}</span>
          </span>
          <ChevronRight className="h-5 w-5 text-text-faint" />
        </button>

        {/* Scan-to-charge: type the code on the charger (or behind its QR) to jump straight to it. */}
        <div className="mt-3 flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-ink-soft px-4">
          <BoltIcon className="h-5 w-5 text-volt" />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') resolveCode(); }}
            placeholder={t('Scan or enter a charger code')}
            aria-label="Scan or enter a charger code"
            enterKeyHint="go"
            className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-text-faint"
          />
          {resolving ? <Spinner className="h-4 w-4 text-volt" /> : code.trim() && (
            <button onClick={resolveCode} className="text-[13px] font-semibold text-volt">{t('Go')}</button>
          )}
        </div>
      </div>

      {/* Live interactive station map */}
      <div className="px-5 pt-4">
        <LiveMap locations={filtered} origin={center} onSelect={(id) => navigate(`/location/${id}`)} />
      </div>

      {/* Filters */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-4">
        <Chip label={t('Available now')} active={onlyAvailable} onClick={() => setOnlyAvailable((v) => !v)} />
        <Chip label={t('Fast ⚡')} active={onlyFast} onClick={() => setOnlyFast((v) => !v)} />
        <Chip label={t('Parking')} active={amenity === 'parking'} onClick={() => setAmenity((v) => (v === 'parking' ? null : 'parking'))} />
        <Chip label={t('WiFi')} active={amenity === 'wifi'} onClick={() => setAmenity((v) => (v === 'wifi' ? null : 'wifi'))} />
        <Chip label={t('Restrooms')} active={amenity === 'restrooms'} onClick={() => setAmenity((v) => (v === 'restrooms' ? null : 'restrooms'))} />
        {categories.map((c) => (
          <Chip key={c} label={c} active={connFilter === c} onClick={() => setConnFilter((v) => (v === c ? null : c))} />
        ))}
      </div>

      {/* List */}
      <div className="px-5 pb-6 pt-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold">{t('Chargers near you')}</h2>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="sortby">{t('Sort by')}</label>
            <select
              id="sortby"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-lg border border-line bg-ink-soft px-2 py-1 text-[12px] text-text-soft outline-none"
            >
              <option value="distance">{t('Nearest')}</option>
              <option value="available">{t('Most available')}</option>
              <option value="power">{t('Fastest')}</option>
              <option value="rating">{t('Top rated')}</option>
            </select>
            <span className="whitespace-nowrap text-[12px] text-text-soft">{filtered.length} {filtered.length === 1 ? t('site') : t('sites')}</span>
          </div>
        </div>

        {loading && <SkeletonList rows={3} />}
        {error && !loading && <ErrorState message={`Couldn’t load locations: ${error}`} onRetry={() => setReloadKey((k) => k + 1)} />}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState icon={<PinIcon className="h-9 w-9" />} title={t('No charging sites yet')} subtitle="This network hasn’t published any public locations." />
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
                    {loc.availableCount != null && loc.chargerCount != null ? (
                      <span className={loc.availableCount > 0 ? 'text-volt' : 'text-amber'}>
                        · {loc.availableCount > 0 ? `${loc.availableCount} ${t('available')}` : t('In use')}
                      </span>
                    ) : (
                      loc.chargerCount != null && <span>· {loc.chargerCount} chargers</span>
                    )}
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

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${active ? 'bg-volt text-ink' : 'border border-line text-text-soft'}`}
    >
      {label}
    </button>
  );
}

/** Group raw OCPI connector standards into driver-friendly filter categories. */
function connectorCategory(standard: string): string {
  const s = standard.toUpperCase();
  if (s.includes('COMBO') || s.includes('CCS')) return 'CCS';
  if (s.includes('CHADEMO')) return 'CHAdeMO';
  if (s.includes('T1')) return 'Type 1';
  if (s.includes('T2') || s.includes('T3')) return 'Type 2';
  if (s.includes('TESLA')) return 'Tesla';
  if (s.includes('DOMESTIC')) return 'Wall plug';
  return 'Other';
}
