import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { Card, Spinner, Toggle, Button, Banner, useAsync } from '../components/ui.tsx';
import { BellIcon, BoltIcon, CardIcon, LeafIcon, UserIcon } from '../components/icons.tsx';
import type { NotificationPreferences, PaymentConfig } from '../lib/types.ts';

export function AccountScreen() {
  const { client, driver, logout } = usePhevnix();
  const navigate = useNavigate();

  const prefs = useAsync(() => client.getNotificationPreferences() as Promise<NotificationPreferences>, []);
  const pay = useAsync(() => client.getPaymentConfig() as Promise<PaymentConfig>, []);
  const [local, setLocal] = useState<Partial<NotificationPreferences['channels']> & Record<string, boolean>>({});

  const channels = { ...(prefs.data?.channels ?? { push: true, email: true, sms: false }), ...local };

  async function toggle(key: 'push' | 'email' | 'sms', value: boolean) {
    setLocal((s) => ({ ...s, [key]: value }));
    const map = { push: 'pushEnabled', email: 'emailEnabled', sms: 'smsEnabled' } as const;
    try {
      await client.updateNotificationPreferences({ [map[key]]: value });
    } catch {
      setLocal((s) => ({ ...s, [key]: !value })); // revert on failure
    }
  }

  const initials = `${driver?.firstName?.[0] ?? ''}${driver?.lastName?.[0] ?? ''}`.toUpperCase() || 'V';

  return (
    <div>
      <ScreenHeader title="Account" />
      <div className="space-y-5 px-5 py-5">
        {/* Profile */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-volt text-[22px] font-extrabold text-ink">{initials}</div>
          <div className="min-w-0">
            <p className="truncate text-[18px] font-bold">{driver?.firstName} {driver?.lastName}</p>
            <p className="truncate text-[13px] text-text-soft">{driver?.email}</p>
          </div>
        </div>

        {/* Notifications */}
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-text-faint">
            <BellIcon className="h-4 w-4" /> Notifications
          </h2>
          <Card className="divide-y divide-line p-0">
            {prefs.loading ? (
              <div className="flex justify-center py-8 text-volt"><Spinner /></div>
            ) : prefs.featureDisabled ? (
              <p className="px-4 py-5 text-[13px] text-text-soft">Notifications aren’t enabled by your provider.</p>
            ) : (
              ([
                ['push', 'Push notifications', 'Charging started, stopped, and reminders'],
                ['email', 'Email', 'Receipts and account updates'],
                ['sms', 'SMS', 'Text alerts for key events'],
              ] as const).map(([key, title, sub]) => (
                <div key={key} className="flex items-center justify-between px-4 py-3.5">
                  <div className="pr-3">
                    <p className="text-[14px] font-medium">{title}</p>
                    <p className="text-[12px] text-text-soft">{sub}</p>
                  </div>
                  <Toggle checked={!!channels[key]} onChange={(v) => toggle(key, v)} />
                </div>
              ))
            )}
          </Card>
        </section>

        {/* Payment */}
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-text-faint">
            <CardIcon className="h-4 w-4" /> Payment
          </h2>
          <Card>
            {pay.loading ? (
              <div className="flex justify-center py-4 text-volt"><Spinner /></div>
            ) : pay.data?.paymentMode === 'phevnix_managed' ? (
              <div className="flex items-start gap-3">
                <CardIcon className="mt-0.5 h-5 w-5 text-volt" />
                <div>
                  <p className="text-[14px] font-semibold">Managed by Voltway</p>
                  <p className="mt-0.5 text-[12.5px] text-text-soft">Add a card to charge instantly. Receipts arrive after each session.</p>
                  <Button variant="outline" className="mt-3 h-10 w-auto px-4">Add payment method</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <LeafIcon className="mt-0.5 h-5 w-5 text-volt" />
                <div>
                  <p className="text-[14px] font-semibold">Billed directly by your provider</p>
                  <p className="mt-0.5 text-[12.5px] text-text-soft">{pay.data?.note ?? 'This network handles payment on its own — nothing to set up here.'}</p>
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* Account actions */}
        <section>
          <Card className="divide-y divide-line p-0">
            <button onClick={() => navigate('/vehicles')} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[14px]">
              <BoltIcon className="h-5 w-5 text-text-soft" /> My vehicles
            </button>
            <button onClick={() => navigate('/reservations')} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[14px]">
              <UserIcon className="h-5 w-5 text-text-soft" /> My reservations
            </button>
            <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[14px] text-rose">
              Sign out
            </button>
          </Card>
        </section>

        {prefs.error && <Banner tone="warn">{prefs.error}</Banner>}
        <p className="pt-2 text-center text-[10px] uppercase tracking-wider text-text-faint">Voltway · Powered by Phevnix eMSP API</p>
      </div>
    </div>
  );
}
