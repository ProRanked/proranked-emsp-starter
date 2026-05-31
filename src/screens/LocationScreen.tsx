import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { Card, EmptyState, SkeletonList, StatusPill, Banner, Button, ErrorState, useAsync } from '../components/ui.tsx';
import { ChevronLeft, HeartIcon, PlugIcon, PinIcon, ChevronRight } from '../components/icons.tsx';
import { LiveMap } from '../components/LiveMap.tsx';
import { asArray, type ChargerLite, type LocationLite, type ReviewsResponse } from '../lib/types.ts';
import { useT } from '../lib/i18n.tsx';

export function LocationScreen() {
  const { id = '' } = useParams();
  const { client } = usePhevnix();
  const navigate = useNavigate();
  const { t } = useT();
  const [saved, setSaved] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [showAllChargers, setShowAllChargers] = useState(false);

  const loc = useAsync(() => client.getLocation(id) as Promise<LocationLite>, [id]);
  const chargers = useAsync(async () => asArray<ChargerLite>(await client.getLocationChargers(id)), [id]);

  async function save() {
    setSaveMsg(null);
    try {
      await client.addFavorite({ targetType: 'location', targetId: id, label: (loc.data as LocationLite)?.name });
      setSaved(true);
    } catch (e) {
      // Favorites can be disabled per network — show that honestly.
      setSaveMsg(e instanceof Error && /feature_disabled/.test(e.message) ? t('Saved places aren’t enabled by your provider.') : t('Could not save.'));
    }
  }

  const l = loc.data;

  return (
    <div>
      <ScreenHeader
        title={l?.name ?? t('Charging site')}
        subtitle={l ? [l.address, l.city].filter(Boolean).join(', ') : undefined}
        back={<button aria-label="Go back" onClick={() => navigate(-1)} className="-ml-1 text-text-soft"><ChevronLeft className="h-6 w-6" /></button>}
        action={
          <button aria-label={saved ? 'Saved' : 'Save this site'} onClick={save} className={`rounded-full p-2 ${saved ? 'text-rose' : 'text-text-soft hover:text-text'}`}>
            <HeartIcon className="h-6 w-6" {...(saved ? { fill: 'currentColor' } : {})} />
          </button>
        }
      />

      <div className="space-y-5 px-5 py-5">
        {saveMsg && <Banner tone="warn">{saveMsg}</Banner>}

        {/* Rating summary up top — visible immediately, not buried below the charger list */}
        {l && l.ratingAverage != null && (l.ratingCount ?? 0) > 0 && (
          <div className="flex items-center gap-2 text-[13px]">
            <Stars value={l.ratingAverage} />
            <b className="text-[14px]">{l.ratingAverage.toFixed(1)}</b>
            <span className="text-text-soft">· {l.ratingCount} {l.ratingCount === 1 ? t('review') : t('reviews')}</span>
          </div>
        )}

        {/* Station photos — operator-uploaded images, when present (horizontal strip) */}
        {l && (l.images?.length ?? 0) > 0 && (
          <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5">
            {l.images!.map((img, i) => {
              const src = img.thumbnailUrl || img.url;
              if (!src) return null;
              return (
                <img
                  key={i}
                  src={src}
                  alt={`${l.name ?? 'Charging site'} photo ${i + 1}`}
                  loading="lazy"
                  className="h-40 w-64 shrink-0 rounded-2xl border border-line object-cover"
                />
              );
            })}
          </div>
        )}

        {/* Hero — real mini-map + directions when geocoded, else a branded fallback */}
        {l && l.latitude != null && l.longitude != null && !(Math.abs(l.latitude) < 0.01 && Math.abs(l.longitude) < 0.01) ? (
          <div className="space-y-3">
            <LiveMap locations={[l]} origin={{ lat: l.latitude, lng: l.longitude }} onSelect={() => {}} showUser={false} interactive={false} height={170} />
            <Button
              variant="outline"
              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${l.latitude},${l.longitude}`, '_blank', 'noopener')}
            >
              <PinIcon className="h-5 w-5" /> {t('Get directions')}
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

        {/* Amenities — what's at this site (hours, parking, restrooms, wifi) + a call shortcut */}
        {l && (l.openingHours || l.hasParking || l.hasRestrooms || l.hasWifi || l.phone) && (
          <div className="flex flex-wrap items-center gap-2">
            {l.openingHours && hoursLabel(l.openingHours, t) && <AmenityChip icon="🕐" label={hoursLabel(l.openingHours, t)!} />}
            {l.hasParking && <AmenityChip icon="🅿️" label={t('Parking')} />}
            {l.hasRestrooms && <AmenityChip icon="🚻" label={t('Restrooms')} />}
            {l.hasWifi && <AmenityChip icon="📶" label={t('WiFi')} />}
            {l.phone && (
              <a
                href={`tel:${l.phone}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-volt/40 bg-volt/10 px-3 py-1.5 text-[12.5px] font-semibold text-volt"
              >
                <span aria-hidden>📞</span> {t('Call')}
              </a>
            )}
          </div>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold">{t('Chargers at this site')}</h2>
            {!chargers.loading && (chargers.data?.length ?? 0) > 0 && (() => {
              const avail = (chargers.data ?? []).filter((c) => /available/i.test(c.status ?? '')).length;
              const total = chargers.data!.length;
              return (
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${avail > 0 ? 'bg-volt/10 text-volt' : 'bg-line text-text-soft'}`}>
                  {avail} {t('of')} {total} {t('available')}
                </span>
              );
            })()}
          </div>
          {chargers.loading && <SkeletonList rows={3} />}
          {chargers.error && <ErrorState message={chargers.error} onRetry={chargers.reload} />}
          {!chargers.loading && (chargers.data?.length ?? 0) === 0 && (
            <EmptyState icon={<PlugIcon className="h-9 w-9" />} title={t('No chargers listed')} />
          )}
          <div className="space-y-3">
            {(showAllChargers ? chargers.data : chargers.data?.slice(0, 8))?.map((c) => (
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
          {/* Keep long sites scannable — collapse the charger list past 8 so reviews/amenities stay reachable. */}
          {!showAllChargers && (chargers.data?.length ?? 0) > 8 && (
            <button onClick={() => setShowAllChargers(true)} className="mt-3 w-full rounded-2xl border border-line py-2.5 text-[13px] font-semibold text-text-soft">
              {t('Show all')} {chargers.data!.length} {t('chargers')}
            </button>
          )}
        </div>

        <LocationReviews locationId={id} />
        <ReportIssue locationId={id} />
      </div>
    </div>
  );
}

const ISSUE_CATEGORIES: { key: string; label: string }[] = [
  { key: 'broken_connector', label: 'Broken connector' },
  { key: 'blocked', label: 'Blocked spot' },
  { key: 'payment', label: 'Payment issue' },
  { key: 'offline', label: 'Offline' },
  { key: 'other', label: 'Other' },
];

function ReportIssue({ locationId }: { locationId: string }) {
  const { client, driver } = usePhevnix();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('broken_connector');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!driver) return null;

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await client.reportLocationIssue(locationId, { category, note: note.trim() || undefined });
      setDone(true);
      setOpen(false);
      setNote('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  if (done) return <Banner tone="volt">{t('Thanks — we’ve let the operator know.')}</Banner>;

  return (
    <div>
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-[12.5px] font-medium text-text-soft underline-offset-2 hover:underline">
          ⚠︎ {t('Report an issue')}
        </button>
      ) : (
        <Card className="space-y-3">
          <p className="text-[14px] font-semibold">{t('Report an issue')}</p>
          <div className="flex flex-wrap gap-2">
            {ISSUE_CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${category === c.key ? 'bg-volt text-ink' : 'border border-line text-text-soft'}`}
              >
                {t(c.label)}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={900}
            rows={3}
            placeholder={t('What’s wrong? (optional)')}
            className="w-full resize-none rounded-xl border border-line bg-ink-soft px-3 py-2 text-[14px] outline-none placeholder:text-text-faint"
          />
          {err && <Banner tone="warn">{err}</Banner>}
          <div className="flex gap-2">
            <Button onClick={submit} loading={busy} className="h-10">{t('Send report')}</Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="h-10">{t('Cancel')}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function LocationReviews({ locationId }: { locationId: string }) {
  const { client, driver } = usePhevnix();
  const { t } = useT();
  const data = useAsync(() => client.getLocationReviews(locationId) as Promise<ReviewsResponse>, [locationId]);
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reviews can be disabled per network (capability gate) — degrade silently.
  if (data.featureDisabled) return null;

  const summary = data.data?.summary;
  const list = data.data?.reviews ?? [];
  const mine = list.find((r) => r.isMine);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await client.submitLocationReview(locationId, { rating, comment: comment.trim() || undefined });
      setWriting(false);
      setComment('');
      data.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  function startWriting() {
    if (mine) {
      setRating(mine.rating);
      setComment(mine.comment ?? '');
    }
    setWriting(true);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold">{t('Reviews')}</h2>
        {summary && summary.count > 0 && (
          <span className="flex items-center gap-1.5 text-[12.5px] text-text-soft">
            <Stars value={summary.average} />
            <b className="text-text">{summary.average.toFixed(1)}</b> · {summary.count}
          </span>
        )}
      </div>

      {data.loading && <SkeletonList rows={2} />}

      {!data.loading && list.length === 0 && !writing && (
        <p className="mb-3 text-[13px] text-text-soft">{t('No reviews yet — be the first to rate this site.')}</p>
      )}

      {/* Write / edit a review (drivers only) */}
      {driver && !writing && (
        <Button variant="outline" className="mb-3 h-10" onClick={startWriting}>
          {mine ? t('Edit your review') : t('Write a review')}
        </Button>
      )}
      {writing && (
        <Card className="mb-3 space-y-3">
          <StarInput value={rating} onChange={setRating} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={t('Share details (optional)')}
            className="w-full resize-none rounded-xl border border-line bg-ink-soft px-3 py-2 text-[14px] outline-none placeholder:text-text-faint"
          />
          {err && <Banner tone="warn">{err}</Banner>}
          <div className="flex gap-2">
            <Button onClick={submit} loading={busy} className="h-10">{t('Submit')}</Button>
            <Button variant="outline" onClick={() => setWriting(false)} className="h-10">{t('Cancel')}</Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {list.map((r) => (
          <Card key={r.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Stars value={r.rating} />
              <span className="text-[11px] text-text-faint">
                {r.isMine ? t('You') : r.authorName ?? 'Driver'}
                {r.updatedAt ? ` · ${new Date(r.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
              </span>
            </div>
            {r.comment && <p className="text-[13.5px] text-text-soft">{r.comment}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Read-only star row (supports halves visually by rounding). */
function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className="text-[13px] tracking-tight text-amber" aria-label={`${value} stars`}>
      {'★★★★★'.slice(0, full)}
      <span className="text-line">{'★★★★★'.slice(full)}</span>
    </span>
  );
}

/** Interactive 1–5 star picker. */
function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} stars`}
          className={`text-[28px] leading-none transition ${n <= value ? 'text-amber' : 'text-line'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/** Compact opening-hours label: "Open 24/7", today's window, or "Closed today". */
function hoursLabel(
  oh: { twentyFourSeven: boolean; regular: { weekday: number; open: string; close: string }[] },
  t: (s: string) => string,
): string | null {
  if (oh.twentyFourSeven) return t('Open 24/7');
  if (!oh.regular?.length) return null;
  const jsDay = new Date().getDay(); // 0=Sun..6=Sat → OCPI 1=Mon..7=Sun
  const ocpiDay = jsDay === 0 ? 7 : jsDay;
  const today = oh.regular.find((r) => r.weekday === ocpiDay);
  return today ? `${t('Today')} ${today.open}–${today.close}` : t('Closed today');
}

function AmenityChip({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card-2 px-3 py-1.5 text-[12.5px] font-medium text-text-soft">
      <span aria-hidden>{icon}</span> {label}
    </span>
  );
}
