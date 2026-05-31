import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { Button, Card, EmptyState, Field, Spinner, Banner, useAsync } from '../components/ui.tsx';
import { ChevronLeft, BoltIcon } from '../components/icons.tsx';
import { asArray } from '../lib/types.ts';
import { useT } from '../lib/i18n.tsx';

interface Vehicle {
  id: string;
  make?: string;
  model?: string;
  year?: number;
  batteryCapacityKwh?: number;
}

export function VehiclesScreen() {
  const { client } = usePhevnix();
  const navigate = useNavigate();
  const { t } = useT();
  const list = useAsync(async () => asArray<Vehicle>(await client.listVehicles()), []);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await client.addVehicle({ make, model, year: year ? Number(year) : undefined });
      setAdding(false); setMake(''); setModel(''); setYear('');
      list.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ScreenHeader
        title={t('My vehicles')}
        subtitle={t('Cars linked to your account')}
        back={<button onClick={() => navigate('/account')} className="-ml-1 text-text-soft"><ChevronLeft className="h-6 w-6" /></button>}
      />
      <div className="space-y-3 px-5 py-5">
        {list.loading && <div className="flex justify-center py-16 text-volt"><Spinner className="h-7 w-7" /></div>}

        {list.featureDisabled && (
          <EmptyState
            icon={<BoltIcon className="h-9 w-9" />}
            title={t('Vehicles aren’t enabled yet')}
            subtitle={t('Your provider hasn’t turned on vehicle linking (e.g. Smartcar). It can be enabled any time — no app update needed.')}
          />
        )}
        {list.error && !list.featureDisabled && <Banner tone="warn">{list.error}</Banner>}

        {!list.loading && !list.featureDisabled && (
          <>
            {(list.data?.length ?? 0) === 0 && !adding && (
              <EmptyState icon={<BoltIcon className="h-9 w-9" />} title={t('No vehicles yet')} subtitle={t('Add your EV to personalize charging.')} />
            )}
            {list.data?.map((v) => (
              <Card key={v.id}>
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-volt/10 text-volt"><BoltIcon className="h-5 w-5" /></div>
                  <div className="flex-1">
                    <p className="text-[14.5px] font-semibold">{[v.make, v.model].filter(Boolean).join(' ') || t('Vehicle')}</p>
                    <p className="text-[12px] text-text-soft">{[v.year, v.batteryCapacityKwh && `${v.batteryCapacityKwh} kWh`].filter(Boolean).join(' · ')}</p>
                  </div>
                  <button onClick={() => client.removeVehicle(v.id).then(list.reload)} className="text-[12px] font-medium text-rose">{t('Remove')}</button>
                </div>
              </Card>
            ))}

            {adding ? (
              <Card>
                <form onSubmit={add} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t('Make')} value={make} onChange={(e) => setMake(e.target.value)} placeholder="Tesla" />
                    <Field label={t('Model')} value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model 3" />
                  </div>
                  <Field label={t('Year')} type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" />
                  <div className="flex gap-2">
                    <Button type="submit" loading={busy}>{t('Save vehicle')}</Button>
                    <Button type="button" variant="outline" onClick={() => setAdding(false)}>{t('Cancel')}</Button>
                  </div>
                </form>
              </Card>
            ) : (
              <Button variant="outline" onClick={() => setAdding(true)}>{t('+ Add a vehicle')}</Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
