/**
 * End-to-end driver journey against the Phevnix eMSP API.
 *
 * Walks the full lifecycle a driver app would: authenticate → discover chargers
 * near you → check pricing → reserve → start/stop a session → set a charging
 * speed limit → manage favorites/vehicles/notifications → inspect payment mode.
 *
 * Capabilities a network has disabled return `403 feature_disabled`; the demo
 * notes and skips them rather than failing — exactly how a real app should react.
 *
 * Configure via environment (or a .env you load yourself):
 *   EMSP_BASE_URL   gateway URL      (default https://api.phevnix.cloud — the lab)
 *   EMSP_API_KEY    publishable key  (phx_...)              [required]
 *   DRIVER_EMAIL    driver login email                      [required]
 *   DRIVER_PASSWORD driver password                         [required]
 *   REGISTER        "true" to register the driver first
 *   LAT, LNG        geo-search origin (default San Juan, PR)
 *
 *   node --experimental-strip-types src/demo.ts
 */

import { PhevnixApiError, PhevnixEmspClient } from './client.ts';

const BASE_URL = process.env.EMSP_BASE_URL ?? 'https://api.phevnix.cloud';
const API_KEY = required('EMSP_API_KEY');
const EMAIL = required('DRIVER_EMAIL');
const PASSWORD = required('DRIVER_PASSWORD');
const LAT = Number(process.env.LAT ?? 18.4248);
const LNG = Number(process.env.LNG ?? -66.0758);

const client = new PhevnixEmspClient({ baseUrl: BASE_URL, apiKey: API_KEY });

async function main() {
  banner(`Phevnix eMSP demo → ${BASE_URL}`);

  // 1. Auth ----------------------------------------------------------------
  if (process.env.REGISTER === 'true') {
    await step('Register driver', () =>
      client.register({ email: EMAIL, password: PASSWORD, firstName: 'Demo', lastName: 'Driver' }),
    );
  }
  const session = await step('Login', () => client.login(EMAIL, PASSWORD));
  if (!session) throw new Error('Login did not return a session.');
  console.log(`   → signed in as ${session.driver.firstName} ${session.driver.lastName} (idTag ${client.tokenUid})`);

  // 2. Discovery -----------------------------------------------------------
  const near = await step('Find chargers near me', () => client.searchLocations(LAT, LNG, 50));
  const firstLocation = firstOf(near);
  if (firstLocation) console.log(`   → nearest: ${firstLocation.name ?? firstLocation.id} (${firstLocation.distanceKm ?? '?'} km)`);

  await step('Browse tariffs', () => client.listTariffs({ activeOnly: true, pageSize: 5 }));

  const chargers = await step('List chargers', () => client.listChargers({ pageSize: 5 }));
  const charger = firstOf(chargers);
  const chargerId: string | undefined = charger?.id;
  if (!chargerId) {
    console.log('\n   No chargers available on this network — skipping charge-control steps.');
  } else {
    console.log(`   → using charger ${charger.name ?? chargerId} (status ${charger.status ?? '?'})`);

    // 3. Reserve → start → limit → stop ------------------------------------
    const reservation = await step('Reserve the connector', () =>
      client.reserve({ chargerId, connectorNumber: 1, expiryMinutes: 15 }), { allowFail: true });
    const reservationId: string | undefined = (reservation as any)?.id;

    await step('Set a 16 A charging limit', () =>
      client.setChargingLimit(chargerId, { connectorNumber: 1, unit: 'A', limit: 16 }), { allowFail: true });
    await step('Read the effective limit', () => client.getChargingLimit(chargerId), { allowFail: true });

    const startResult = await step('Start a charging session', () =>
      client.startCharging({ chargerId, connectorNumber: 1 }), { allowFail: true });
    const sessionId: string | undefined = (startResult as any)?.id;

    if (sessionId) {
      await step('Stop the charging session', () => client.stopCharging(sessionId), { allowFail: true });
    }
    if (reservationId) {
      await step('Cancel the reservation', () => client.cancelReservation(reservationId), { allowFail: true });
    }
    await step('Clear the charging limit', () => client.clearChargingLimit(chargerId), { allowFail: true });
  }

  // 4. Driver account: notifications, vehicles, favorites ------------------
  await step('Read notification preferences', () => client.getNotificationPreferences(), { allowFail: true });
  await step('Mute SMS, keep email', () =>
    client.updateNotificationPreferences({ smsEnabled: false, emailEnabled: true }), { allowFail: true });

  // Vehicles / Favorites may be disabled per network (403 feature_disabled).
  await step('List vehicles', () => client.listVehicles(), { allowFail: true });
  await step('Add a vehicle', () =>
    client.addVehicle({ make: 'Tesla', model: 'Model 3', year: 2024, batteryCapacityKwh: 60 }), { allowFail: true });

  if (firstLocation?.id) {
    await step('Favorite the nearest location', () =>
      client.addFavorite({ targetType: 'location', targetId: firstLocation.id }), { allowFail: true });
  }
  await step('List favorites', () => client.listFavorites(), { allowFail: true });

  // 5. Payment mode --------------------------------------------------------
  const payCfg = await step('Discover payment handling', () => client.getPaymentConfig());
  console.log(`   → payment mode: ${(payCfg as any)?.paymentMode ?? 'unknown'}`);

  banner('Done ✔  — the driver journey ran end-to-end.');
}

// ── tiny console helpers ──────────────────────────────────────────────────

async function step<T>(label: string, fn: () => Promise<T>, opts: { allowFail?: boolean } = {}): Promise<T | undefined> {
  process.stdout.write(`\n▶ ${label} ... `);
  try {
    const result = await fn();
    console.log('ok');
    return result;
  } catch (err) {
    if (err instanceof PhevnixApiError) {
      if (err.errorCode === 'feature_disabled') {
        console.log(`skipped (capability disabled for this network)`);
        return undefined;
      }
      console.log(`${err.status} ${err.errorCode ?? ''} — ${err.message}`);
      if (!opts.allowFail) throw err;
      return undefined;
    }
    console.log('error');
    throw err;
  }
}

function firstOf(result: unknown): any {
  const arr = Array.isArray(result) ? result : (result as any)?.data ?? (result as any)?.items;
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : undefined;
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
