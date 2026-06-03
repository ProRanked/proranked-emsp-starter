import { useEffect, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { Card, Button, Spinner, Banner, useAsync } from './ui.tsx';
import { CardIcon } from './icons.tsx';
import { asArray } from '../lib/types.ts';
import { useT } from '../lib/i18n.tsx';

interface SavedCard { id: string; brand: string; last4: string; expMonth: number; expYear: number; isDefault: boolean }

// Cache the Stripe.js loader per publishable key (loadStripe must not be called on every render).
const stripeCache = new Map<string, Promise<Stripe | null>>();
function stripeFor(pk: string) {
  if (!stripeCache.has(pk)) stripeCache.set(pk, loadStripe(pk));
  return stripeCache.get(pk)!;
}

/** Saved-card management for phevnix_managed networks — list, add (Stripe Elements), default, remove.
 *  All card data is collected directly by Stripe; the app only ever sees brand/last4. */
export function PaymentMethods() {
  const { client } = usePhevnix();
  const { t } = useT();
  const cards = useAsync(async () => asArray<SavedCard>(await client.getPaymentMethods()), []);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function makeDefault(id: string) {
    setBusyId(id);
    try { await client.setDefaultPaymentMethod(id); cards.reload(); } finally { setBusyId(null); }
  }
  async function remove(id: string) {
    setBusyId(id);
    try { await client.removePaymentMethod(id); cards.reload(); } finally { setBusyId(null); }
  }

  if (adding) {
    return <AddCardSheet onAdded={() => { setAdding(false); cards.reload(); }} onCancel={() => setAdding(false)} />;
  }

  return (
    <div className="space-y-3">
      {cards.loading && <div className="flex justify-center py-4 text-volt"><Spinner /></div>}
      {!cards.loading && (cards.data ?? []).map((c) => (
        <Card key={c.id} className="flex items-center gap-3">
          <CardIcon className="h-5 w-5 text-volt" />
          <div className="flex-1">
            <p className="text-[14px] font-semibold capitalize">{c.brand} •••• {c.last4}</p>
            <p className="text-[12px] text-text-soft">{t('Expires')} {String(c.expMonth).padStart(2, '0')}/{String(c.expYear).slice(-2)}{c.isDefault ? ` · ${t('Default')}` : ''}</p>
          </div>
          {!c.isDefault && <button onClick={() => makeDefault(c.id)} disabled={busyId === c.id} className="text-[12px] font-medium text-volt">{t('Make default')}</button>}
          <button onClick={() => remove(c.id)} disabled={busyId === c.id} className="text-[12px] font-medium text-rose">{t('Remove')}</button>
        </Card>
      ))}
      {!cards.loading && (cards.data?.length ?? 0) === 0 && (
        <p className="text-[12.5px] text-text-soft">{t('Add a card to charge instantly. Receipts arrive after each session.')}</p>
      )}
      <Button variant="outline" onClick={() => setAdding(true)} className="h-10 w-auto px-4"><CardIcon className="h-4 w-4" /> {t('Add a card')}</Button>
    </div>
  );
}

/**
 * Self-contained "add a card" flow: creates the Stripe SetupIntent, collects the card via Stripe
 * Elements, and — on success — promotes the new card to the driver's default so the very next charge
 * works without a separate step (matters most for the driver's first card). Reused both on the
 * Account screen and inline in the start-charging flow. `onAdded` fires only after the default is set.
 */
export function AddCardSheet({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const { client } = usePhevnix();
  const { t } = useT();
  const [intent, setIntent] = useState<{ clientSecret: string; publishableKey: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const r = (await client.createSetupIntent()) as { clientSecret?: string; publishableKey?: string };
        if (cancelled) return;
        if (!r.clientSecret || !r.publishableKey) { setError(t('Card setup isn’t available right now.')); return; }
        setIntent({ clientSecret: r.clientSecret, publishableKey: r.publishableKey });
      } catch {
        if (!cancelled) setError(t('Card setup isn’t available right now.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // `t` is read only for two static error strings — excluding it keeps the SetupIntent from being
    // re-created (and a half-typed card field wiped) if the i18n provider re-renders mid-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // Stripe attaches the card to the customer on confirm; promote it to default so AuthorizeSession
  // (which charges the default card) succeeds immediately. Best-effort — the card is already saved.
  async function handleSaved(pmId: string | null) {
    if (pmId) { try { await client.setDefaultPaymentMethod(pmId); } catch { /* non-fatal: card is saved */ } }
    onAdded();
  }

  if (loading) return <div className="flex justify-center py-6 text-volt"><Spinner /></div>;
  if (error || !intent) {
    return (
      <div className="space-y-3">
        <Banner tone="warn">{error ?? t('Card setup isn’t available right now.')}</Banner>
        <Button variant="outline" onClick={onCancel}>{t('Cancel')}</Button>
      </div>
    );
  }
  return (
    <Elements stripe={stripeFor(intent.publishableKey)} options={{ clientSecret: intent.clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#2ee6a6' } } }}>
      <AddCardForm onDone={handleSaved} onCancel={onCancel} />
    </Elements>
  );
}

function AddCardForm({ onDone, onCancel }: { onDone: (paymentMethodId: string | null) => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true); setErr(null);
    const { error, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' });
    setBusy(false);
    if (error) { setErr(error.message ?? t('Could not save the card.')); return; }
    // payment_method is a string id when expand isn't requested; tolerate the expanded object too.
    const pm = setupIntent?.payment_method;
    const pmId = typeof pm === 'string' ? pm : (pm?.id ?? null);
    onDone(pmId);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <PaymentElement />
      {err && <Banner tone="warn">{err}</Banner>}
      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={!stripe}>{t('Save card')}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>{t('Cancel')}</Button>
      </div>
    </form>
  );
}
