import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { Card, EmptyState, SkeletonList, StatusPill, Banner, Button, ErrorState, useAsync } from '../components/ui.tsx';
import { ChevronLeft, HeartIcon, PlugIcon, PinIcon, ChevronRight } from '../components/icons.tsx';
import { LiveMap } from '../components/LiveMap.tsx';
import { asArray, type ChargerLite, type LocationLite } from '../lib/types.ts';

export function LocationScreen() {
  const { id = '' } = useParams();
  const { client } = usePhevnix();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const loc = useAsync(() => client.getLocation(id) as Promise<LocationLite>, [id]);
  const chargers = useAsync(async () => asArray<ChargerLite>(await client.getLocationChargers(id)), [id]);

  async function save() {
    setSaveMsg(null);
    try {
      await client.addFavorite({ targetType: 'location', targetId: id, label: (loc.data as LocationLite)?.name });
      setSaved(true);
    } catch (e) {
      // Favorites can be disabled per network — show that honestly.
      setSaveMsg(e instanceof Error && /feature_disabled/.test(e.message) ? 'Saved places aren’t enabled by your provider.' : 'Could not save.');
    }
  }

  const l = loc.data;

  return (
    <div>
      <ScreenHeader
        title={l?.name ?? 'Charging site'}
        subtitle={l ? [l.address, l.city].filter(Boolean).join(', ') : undefined}
        back={<button onClick={() => navigate(-1)} className="-ml-1 text-text-soft"><ChevronLeft className="h-6 w-6" /></button>}
        action={
          <button onClick={save} className={`rounded-full p-2 ${saved ? 'text-rose' : 'text-text-soft hover:text-text'}`}>
            <HeartIcon className="h-6 w-6" {...(saved ? { fill: 'currentColor' } : {})} />
          </button>
        }
      />

      <div className="space-y-5 px-5 py-5">
        {saveMsg && <Banner tone="warn">{saveMsg}</Banner>}

        {/* Hero — real mini-map + directions when geocoded, else a branded fallback */}
        {l && l.latitude != null && l.longitude != null && !(Math.abs(l.latitude) < 0.01 && Math.abs(l.longitude) < 0.01) ? (
          <div className="space-y-3">
            <LiveMap locations={[l]} origin={{ lat: l.latitude, lng: l.longitude }} onSelect={() => {}} showUser={false} interactive={false} height={170} />
            <Button
              variant="outline"
              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${l.latitude},${l.longitude}`, '_blank', 'noopener')}
            >
              <PinIcon className="h-5 w-5" /> Get directions
            </Button>
          </div>
        ) : (
          <div className="relative h-40 overflow-hidden rounded-3xl border border-line bg-card-2">
            <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_30%_-10%,rgba(46,230,166,0.20),transparent_55%)]" />
            <div className="absolute bottom-4 left-4 flex items-center gap-2 text-text-soft">
              <PinIcon className="h-5 w-5 text-volt" />
              <span className="text-[13px]">{l?.city ?? 'Location'}{l?.state ? `, ${l.state}` : ''}</span>
            </div>
          </div>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold">Chargers at this site</h2>
            {!chargers.loading && (chargers.data?.length ?? 0) > 0 && (() => {
              const avail = (chargers.data ?? []).filter((c) => /available/i.test(c.status ?? '')).length;
              const total = chargers.data!.length;
              return (
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${avail > 0 ? 'bg-volt/10 text-volt' : 'bg-line text-text-soft'}`}>
                  {avail} of {total} available
                </span>
              );
            })()}
          </div>
          {chargers.loading && <SkeletonList rows={3} />}
          {chargers.error && <ErrorState message={chargers.error} onRetry={chargers.reload} />}
          {!chargers.loading && (chargers.data?.length ?? 0) === 0 && (
            <EmptyState icon={<PlugIcon className="h-9 w-9" />} title="No chargers listed" />
          )}
          <div className="space-y-3">
            {chargers.data?.map((c) => (
              <Card key={c.id} onClick={() => navigate(`/charger/${c.id}`)}>
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card-2 text-volt">
                    <PlugIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold">{c.name ?? c.serialNumber ?? 'Charger'}</p>
                    <p className="text-[12px] text-text-soft">{c.connectorCount ?? 0} connectors{c.maxPowerKw ? ` · up to ${c.maxPowerKw} kW` : ''}</p>
                  </div>
                  <StatusPill status={c.status} />
                  <ChevronRight className="h-5 w-5 text-text-faint" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
