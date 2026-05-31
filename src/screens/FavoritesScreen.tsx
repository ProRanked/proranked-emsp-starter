import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { Card, EmptyState, Spinner, Banner, useAsync } from '../components/ui.tsx';
import { HeartIcon, BoltIcon, ChevronRight } from '../components/icons.tsx';
import { asArray } from '../lib/types.ts';
import { useT } from '../lib/i18n.tsx';

interface Favorite {
  id: string;
  targetType: 'location' | 'charger';
  targetId?: string;
  label?: string;
}

export function FavoritesScreen() {
  const { client } = usePhevnix();
  const navigate = useNavigate();
  const { t } = useT();
  const [removing, setRemoving] = useState<string | null>(null);
  const list = useAsync(async () => asArray<Favorite>(await client.listFavorites()), []);

  async function remove(id: string) {
    setRemoving(id);
    try {
      await client.removeFavorite(id);
      list.reload();
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div>
      <ScreenHeader title={t('Saved places')} subtitle={t('Your go-to charging spots')} />
      <div className="space-y-3 px-5 py-5">
        {list.loading && <div className="flex justify-center py-16 text-volt"><Spinner className="h-7 w-7" /></div>}

        {list.featureDisabled && (
          <EmptyState
            icon={<HeartIcon className="h-9 w-9" />}
            title={t('Saved places aren’t enabled yet')}
            subtitle={t('Your charging provider hasn’t turned on saved places. It can be enabled any time — no app update needed.')}
          />
        )}
        {list.error && !list.featureDisabled && <Banner tone="warn">{list.error}</Banner>}

        {!list.loading && !list.featureDisabled && (list.data?.length ?? 0) === 0 && (
          <EmptyState icon={<HeartIcon className="h-9 w-9" />} title={t('No saved places')} subtitle={t('Tap the heart on any site to save it here.')} />
        )}

        {list.data?.map((f) => (
          <Card key={f.id}>
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-volt/10 text-volt"><BoltIcon className="h-5 w-5" /></div>
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => f.targetType === 'location' && f.targetId && navigate(`/location/${f.targetId}`)}
              >
                <p className="truncate text-[14.5px] font-semibold">{f.label ?? t('Saved place')}</p>
                <p className="text-[12px] capitalize text-text-soft">{f.targetType}</p>
              </div>
              <button onClick={() => remove(f.id)} className="rounded-full p-2 text-rose disabled:opacity-50" disabled={removing === f.id}>
                <HeartIcon className="h-5 w-5" fill="currentColor" />
              </button>
              <ChevronRight className="h-5 w-5 text-text-faint" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
