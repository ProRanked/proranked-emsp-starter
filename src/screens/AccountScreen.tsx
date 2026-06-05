import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhevnix, requestNotificationPermission } from '../context/PhevnixProvider.tsx';
import { subscribeToPush } from '../lib/push.ts';
import { PaymentMethods } from '../components/PaymentMethods.tsx';
import { ScreenHeader } from '../components/AppLayout.tsx';
import { Card, Spinner, Toggle, Banner, useAsync, money } from '../components/ui.tsx';
import { BellIcon, BoltIcon, CardIcon, LeafIcon, UserIcon } from '../components/icons.tsx';
import { asArray, type NotificationPreferences, type PaymentConfig, type ChargingSession } from '../lib/types.ts';
import { useT } from '../lib/i18n.tsx';

export function AccountScreen() {
  const { client, driver, logout } = usePhevnix();
  const navigate = useNavigate();
  const { t, lang, setLang } = useT();

  // GET /emsp/v1/auth/driver/me — re-fetch the live profile (and validate the token) on mount;
  // fall back to the driver captured at login while it loads or if the network's profile read is off.
  const profile = useAsync(() => client.me() as Promise<{ firstName?: string; lastName?: string; email?: string; tokenUid?: string; phone?: string; createdAt?: string } | null>, []);
  const prefs = useAsync(() => client.getNotificationPreferences() as Promise<NotificationPreferences>, []);
  const pay = useAsync(() => client.getPaymentConfig() as Promise<PaymentConfig>, []);
  const sessions = useAsync(async () => asArray<ChargingSession>(await client.listSessions({ pageSize: 100 })), []);
  const [local, setLocal] = useState<Partial<NotificationPreferences['channels']> & Record<string, boolean>>({});

  const me = { ...driver, ...(profile.data ?? {}) };

  const sList = sessions.data ?? [];
  const totalKwh = sList.reduce((s, x) => s + (x.energyDeliveredKwh ?? 0), 0);
  const totalSpent = sList.reduce((s, x) => s + (x.total ?? x.cost ?? 0), 0);
  const statsCurrency = sList.find((s) => s.currency)?.currency ?? 'USD';

  const channels = { ...(prefs.data?.channels ?? { push: true, email: true, sms: false }), ...local };

  async function toggle(key: 'push' | 'email' | 'sms', value: boolean) {
    setLocal((s) => ({ ...s, [key]: value }));
    // Turning push on asks for OS-notification permission and registers this device for
    // web push, so session events surface in the system notification center even when the
    // app tab is closed.
    if (key === 'push' && value) {
      void requestNotificationPermission().then((ok) => {
        if (ok) void subscribeToPush(client);
      });
    }
    const map = { push: 'pushEnabled', email: 'emailEnabled', sms: 'smsEnabled' } as const;
    try {
      await client.updateNotificationPreferences({ [map[key]]: value });
    } catch {
      setLocal((s) => ({ ...s, [key]: !value })); // revert on failure
    }
  }

  const initials = `${me.firstName?.[0] ?? ''}${me.lastName?.[0] ?? ''}`.toUpperCase() || 'V';

  return (
    <div>
      <ScreenHeader title={t('Account')} />
      <div className="space-y-5 px-5 py-5">
        {/* Profile */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-volt text-[22px] font-extrabold text-ink">{initials}</div>
          <div className="min-w-0">
            <p className="truncate text-[18px] font-bold">{me.firstName} {me.lastName}</p>
            <p className="truncate text-[13px] text-text-soft">{me.email}</p>
          </div>
        </div>

        {/* Charge tag (RFID) + lifetime stats */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] text-text-soft">{t('Your charge tag (RFID)')}</p>
              <p className="font-mono text-[15px] font-bold tracking-[0.15em]">{me.tokenUid ?? driver?.tokenUid ?? '—'}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-volt/10 text-volt"><BoltIcon className="h-5 w-5" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-line pt-3 text-center">
            <div><p className="text-[16px] font-bold">{sList.length}</p><p className="text-[11px] text-text-soft">{t('sessions')}</p></div>
            <div><p className="text-[16px] font-bold">{totalKwh.toFixed(0)}</p><p className="text-[11px] text-text-soft">kWh</p></div>
            <div><p className="text-[16px] font-bold">{money(totalSpent, statsCurrency)}</p><p className="text-[11px] text-text-soft">{t('spent')}</p></div>
          </div>
        </Card>

        {/* Notifications */}
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-text-faint">
            <BellIcon className="h-4 w-4" /> {t('Notifications')}
          </h2>
          <Card className="divide-y divide-line p-0">
            {prefs.loading ? (
              <div className="flex justify-center py-8 text-volt"><Spinner /></div>
            ) : prefs.featureDisabled ? (
              <p className="px-4 py-5 text-[13px] text-text-soft">{t('Notifications aren’t enabled by your provider.')}</p>
            ) : (
              ([
                ['push', 'Push notifications', 'Charging started, stopped, and reminders'],
                ['email', 'Email', 'Receipts and account updates'],
                ['sms', 'SMS', 'Text alerts for key events'],
              ] as const).map(([key, title, sub]) => (
                <div key={key} className="flex items-center justify-between px-4 py-3.5">
                  <div className="pr-3">
                    <p className="text-[14px] font-medium">{t(title)}</p>
                    <p className="text-[12px] text-text-soft">{t(sub)}</p>
                  </div>
                  <Toggle checked={!!channels[key]} onChange={(v) => toggle(key, v)} label={t(title)} />
                </div>
              ))
            )}
          </Card>
        </section>

        {/* Payment */}
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-text-faint">
            <CardIcon className="h-4 w-4" /> {t('Payment')}
          </h2>
          <Card>
            {pay.loading ? (
              <div className="flex justify-center py-4 text-volt"><Spinner /></div>
            ) : pay.error ? (
              // Don't assume self-managed when the config call simply failed — offer a retry instead.
              <div className="space-y-2">
                <Banner tone="warn">{t('Couldn’t load payment options.')}</Banner>
                <button onClick={pay.reload} className="text-[13px] font-semibold text-volt">{t('Try again')}</button>
              </div>
            ) : pay.data?.paymentMode === 'phevnix_managed' ? (
              <div>
                <p className="mb-2 flex items-center gap-2 text-[14px] font-semibold"><CardIcon className="h-5 w-5 text-volt" /> {t('Managed by Voltway')}</p>
                <PaymentMethods />
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <LeafIcon className="mt-0.5 h-5 w-5 text-volt" />
                <div>
                  <p className="text-[14px] font-semibold">{t('Billed directly by your provider')}</p>
                  {/* The API's `note` is developer-facing ("handle payment in your own app") —
                      never show it to drivers; use driver-friendly copy. */}
                  <p className="mt-0.5 text-[12.5px] text-text-soft">{t('This network handles payment on its own — nothing to set up here.')}</p>
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* Language */}
        <section>
          <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-text-faint">{t('Language')}</h2>
          <Card className="flex gap-2">
            {(['en', 'es'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition ${lang === l ? 'bg-volt text-ink' : 'border border-line text-text-soft'}`}
              >
                {l === 'en' ? 'English' : 'Español'}
              </button>
            ))}
          </Card>
        </section>

        {/* Account actions */}
        <section>
          <Card className="divide-y divide-line p-0">
            <button onClick={() => navigate('/reservations')} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[14px]">
              <UserIcon className="h-5 w-5 text-text-soft" /> {t('My reservations')}
            </button>
            <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[14px] text-rose">
              {t('Sign out')}
            </button>
          </Card>
        </section>

        {prefs.error && <Banner tone="warn">{prefs.error}</Banner>}
        <p className="pt-2 text-center text-[10px] uppercase tracking-wider text-text-faint">Voltway · Powered by Phevnix eMSP API</p>
      </div>
    </div>
  );
}
