/**
 * End-to-end driver journey against the Phevnix eMSP API — the canonical example
 * that exercises EVERY driver-facing endpoint the SDK exposes.
 *
 * Walks the full lifecycle a driver app would: authenticate → discover locations &
 * chargers near you → inspect pricing → scan-to-charge → reserve → start/stop a
 * session → set/read a charging speed → schedule a future charge → manage
 * favorites/notifications → inspect payment mode & saved cards.
 *
 * Capabilities a network has disabled return `403 feature_disabled`; the demo notes
 * and skips them rather than failing — exactly how a real app should react. Steps
 * that need live hardware (start/stop/reserve) are `allowFail` so the demo still
 * completes against a network with no online charger.
 *
 * Operator/CPMS endpoints (users, transactions, analytics, reports, webhooks,
 * charger reboot) are intentionally NOT called — a publishable driver key can't use
 * them; they belong to a server-side integration, not a driver app.
 *
 * Configure via environment (or a .env you load yourself):
 *   EMSP_BASE_URL   gateway URL      (default https://api.proranked.com)
 *   EMSP_API_KEY    publishable key  (pr_pk_...)              [required]
 *   DRIVER_EMAIL    driver login email                      [required]
 *   DRIVER_PASSWORD driver password                         [required]
 *   REGISTER        "true" to register the driver first
 *   LAT, LNG        geo-search origin (default San Juan, PR)
 *   DEMO_RESET      "true" to also soft-reset the charger (disruptive — off by default)
 *
 *   node --experimental-strip-types examples/cli-demo.ts
 */

import { PhevnixApiError, PhevnixEmspClient } from '../src/lib/phevnix.ts';

const BASE_URL = process.env.EMSP_BASE_URL ?? 'https://api.proranked.com';
const API_KEY = required('EMSP_API_KEY');
const EMAIL = required('DRIVER_EMAIL');
const PASSWORD = required('DRIVER_PASSWORD');
const LAT = Number(process.env.LAT ?? 18.4248);
const LNG = Number(process.env.LNG ?? -66.0758);

const client = new PhevnixEmspClient({ baseUrl: BASE_URL, apiKey: API_KEY });

async function main() {
  banner(`Phevnix eMSP demo → ${BASE_URL}`);

  // 1. Authentication --------------------------------------------------------
  if (process.env.REGISTER === 'true') {
    await step('Register driver', () =>
      client.register({ email: EMAIL, password: PASSWORD, firstName: 'Demo', lastName: 'Driver' }));
  }
  const session = await step('Login', () => client.login(EMAIL, PASSWORD));
  if (!session) throw new Error('Login did not return a session.');
  console.log(`   → signed in as ${session.driver.firstName} ${session.driver.lastName} (idTag ${client.tokenUid})`);
  await step('Get my profile', () => client.me(), { allowFail: true });
  // forgot-password sends a reset email; reset-password (not shown) consumes the token from it.
  await step('Request a password-reset email', () => client.forgotPassword(EMAIL), { allowFail: true });

  // 2. Discovery -------------------------------------------------------------
  const near = await step('Find locations near me (geo-search)', () => client.searchLocations(LAT, LNG, 50));
  const firstLocation = firstOf(near);
  if (firstLocation) console.log(`   → nearest: ${firstLocation.name ?? firstLocation.id} (${firstLocation.distanceKm ?? '?'} km)`);
  await step('List locations', () => client.listLocations({ pageSize: 5 }));
  if (firstLocation?.id) {
    await step('Get location detail', () => client.getLocation(firstLocation.id));
    await step('List chargers at the location', () => client.getLocationChargers(firstLocation.id), { allowFail: true });
    await step('Read location reviews', () => client.getLocationReviews(firstLocation.id), { allowFail: true });
  }

  const tariffs = await step('Browse tariffs', () => client.listTariffs({ activeOnly: true, pageSize: 5 }));
  const tariff = firstOf(tariffs);
  if (tariff?.id) {
    await step('Get tariff detail', () => client.getTariff(tariff.id), { allowFail: true });
    await step('Estimate a session cost', () =>
      client.estimateCost({ tariffId: tariff.id, energyKwh: 20, durationMinutes: 60 }), { allowFail: true });
  }

  // 3. Pick an ONLINE charger and drive a real session -----------------------
  const chargers = await step('List chargers', () => client.listChargers({ pageSize: 50 }));
  const charger = pickStartable(chargers);
  const chargerId: string | undefined = charger?.id;
  if (!chargerId) {
    console.log('\n   No online charger on this network — skipping charge-control steps.');
  } else {
    console.log(`   → using charger ${charger.uid ?? charger.name ?? chargerId} (status ${charger.status ?? '?'}, online ${charger.isOnline ?? '?'})`);
    await step('Get charger detail', () => client.getCharger(chargerId));
    // Scan-to-charge: resolve a charger by its scanned uid / EVSE id.
    if (charger.uid) await step('Resolve charger by QR / EVSE id', () => client.getChargerInfo(charger.uid), { allowFail: true });
    const connId = firstConnectorId(charger);
    if (connId) await step('Get connector status', () => client.getConnectorStatus(connId), { allowFail: true });

    await step('Set a 16 A charging limit', () =>
      client.setChargingLimit(chargerId, { connectorNumber: 1, unit: 'A', limit: 16 }), { allowFail: true });
    await step('Read the effective limit', () => client.getChargingLimit(chargerId), { allowFail: true });

    const startResult = await step('Start a charging session', () =>
      client.startCharging({ chargerId, connectorNumber: 1 }), { allowFail: true });
    if (startResult) {
      // /charging/start is async — it returns a command ref, and the session row is created when
      // the charger confirms (StartTransaction). Resolve the now-ACTIVE session to read/stop it.
      await delay(5000);
      const active = firstOf(await client.listSessions({ status: 'ACTIVE', pageSize: 1 }).catch(() => null));
      const sessionId: string | undefined = active?.id;
      if (sessionId) {
        await step('Read the live session', () => client.getSession(sessionId), { allowFail: true });
        await step('Trigger a status/meter message', () => client.triggerMessage(chargerId, 'MeterValues', 1), { allowFail: true });
        await step('Stop the charging session', () => client.stopCharging(sessionId), { allowFail: true });
      } else {
        console.log('   (no ACTIVE session resolved yet — the charger may still be confirming)');
      }
    }
    await step('Unlock the connector (release the cable)', () => client.unlockConnector(chargerId, 1), { allowFail: true });
    await step('Clear the charging limit', () => client.clearChargingLimit(chargerId), { allowFail: true });

    // Reservations (connector is free again after the session ended).
    const reservation = await step('Reserve the connector', () =>
      client.reserve({ chargerId, connectorNumber: 1, expiryMinutes: 15 }), { allowFail: true });
    const reservationId: string | undefined = (reservation as any)?.id;
    if (reservationId) {
      await step('Get the reservation', () => client.getReservation(reservationId), { allowFail: true });
      await step('Cancel the reservation', () => client.cancelReservation(reservationId), { allowFail: true });
    }
    await step('List reservations', () => client.listReservations({ pageSize: 5 }), { allowFail: true });

    // Scheduled / departure charging.
    const sched = await step('Schedule a future charge', () =>
      client.scheduleCharge({ chargerId, connectorNumber: 1, scheduledTime: new Date(Date.now() + 3_600_000).toISOString() }), { allowFail: true });
    const schedId: string | undefined = (sched as any)?.id;
    await step('List scheduled charges', () => client.listScheduledCharges(), { allowFail: true });
    if (schedId) await step('Cancel the scheduled charge', () => client.cancelScheduledCharge(schedId), { allowFail: true });

    if (process.env.DEMO_RESET === 'true') {
      await step('Soft-reset the charger', () => client.resetCharger(chargerId, 'Soft'), { allowFail: true });
    }
  }

  // 4. History ---------------------------------------------------------------
  const sessions = await step('List my charging sessions', () => client.listSessions({ pageSize: 5 }));
  const past = firstOf(sessions);
  if (past?.id) await step('Open a past session receipt', () => client.getSession(past.id), { allowFail: true });

  // 5. Account: notifications & favorites ------------------------------------
  await step('Read notification preferences', () => client.getNotificationPreferences(), { allowFail: true });
  await step('Mute SMS, keep email', () =>
    client.updateNotificationPreferences({ smsEnabled: false, emailEnabled: true }), { allowFail: true });
  if (firstLocation?.id) {
    const fav = await step('Favorite the nearest location', () =>
      client.addFavorite({ targetType: 'location', targetId: firstLocation.id }), { allowFail: true });
    await step('List favorites', () => client.listFavorites(), { allowFail: true });
    const favId: string | undefined = (fav as any)?.id;
    if (favId) await step('Remove the favorite', () => client.removeFavorite(favId), { allowFail: true });
  }

  // 6. Payments --------------------------------------------------------------
  const payCfg = await step('Discover payment handling', () => client.getPaymentConfig());
  const mode = (payCfg as any)?.paymentMode ?? 'unknown';
  console.log(`   → payment mode: ${mode}`);
  if (mode === 'phevnix_managed') {
    await step('List saved cards', () => client.getPaymentMethods(), { allowFail: true });
    await step('Begin saving a card (SetupIntent)', () => client.createSetupIntent(), { allowFail: true });
  }

  banner('Done ✔  — the full driver journey ran end-to-end.');
}

// ── tiny console helpers ──────────────────────────────────────────────────

async function step<T>(label: string, fn: () => Promise<T>, opts: { allowFail?: boolean } = {}): Promise<T | undefined> {
  process.stdout.write(`\n▶ ${label} ... `);
  try {
    const result = await fn();
    console.log('ok');
    return result;
  } catch (err) {
    if (err instanceof PhevnixApiError && err.errorCode === 'feature_disabled') {
      console.log('skipped (capability disabled for this network)');
      return undefined;
    }
    const detail = err instanceof PhevnixApiError
      ? `${err.status} ${err.errorCode ?? ''} — ${err.message}`.trim()
      : err instanceof Error ? err.message : String(err);
    if (opts.allowFail) {
      console.log(`skipped (${detail})`);
      return undefined;
    }
    console.log(`error — ${detail}`);
    throw err;
  }
}

function arrayOf(result: unknown): any[] {
  const arr = Array.isArray(result) ? result : (result as any)?.data ?? (result as any)?.items ?? (result as any)?.methods;
  return Array.isArray(arr) ? arr : [];
}

function firstOf(result: unknown): any {
  const arr = arrayOf(result);
  return arr.length > 0 ? arr[0] : undefined;
}

/** Prefer an online/available charger so start/reserve actually run, else the first one. */
function pickStartable(result: unknown): any {
  const arr = arrayOf(result);
  return arr.find((c: any) => c?.isOnline === true)
    ?? arr.find((c: any) => typeof c?.status === 'string' && /available/i.test(c.status))
    ?? arr[0];
}

function firstConnectorId(charger: any): string | undefined {
  const c = charger?.connectors?.[0];
  return c?.id ?? c?.connectorId;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function banner(text: string) {
  const line = '─'.repeat(Math.max(text.length, 20));
  console.log(`\n${line}\n${text}\n${line}`);
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}. See README.md / .env.example.`);
    process.exit(1);
  }
  return v;
}

main().catch((err) => {
  console.error('\n✖ Demo failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
