# Phevnix eMSP API — Sample App

A small, dependency-free **reference client** and **end-to-end demo** for the
Phevnix eMSP API (`/emsp/v1`). Use it as a copy-paste starting point for a driver
app, or run the demo to see the whole driver journey against a live network.

> The eMSP API is the driver/eMobility surface of the Phevnix platform. Pair it
> with a **publishable** API key (`phx_…`). It's the "vibe-coder friendly" half of
> the two-API model — operator/fleet control lives in the separate CPMS API.

## What it shows

The [`PhevnixEmspClient`](src/client.ts) wraps every capability of the API and
the demo ([`src/demo.ts`](src/demo.ts)) walks them in order:

| Step | Endpoints |
|------|-----------|
| Driver auth | `POST /auth/driver/{register,login,refresh}`, `GET /auth/driver/me` |
| Discovery | `GET /locations`, `/locations/search`, `/tariffs`, `/chargers` |
| Reserve | `POST /reservations`, `GET /reservations`, `DELETE /reservations/{id}` |
| Charge | `POST /charging/start`, `POST /charging/stop`, `GET /charging/sessions` |
| Smart charging | `GET/PUT/DELETE /smart-charging/{chargerId}/limit` |
| Remote control | `POST /remote-control/{chargerId}/{unlock,trigger}` |
| Notifications | `GET/PUT /notifications/preferences` |
| Vehicles | `GET/POST/DELETE /vehicles` |
| Favorites | `GET/POST/DELETE /favorites` |
| Payments | `GET /payments/config`, `/payments/methods`, `POST /payments/checkout` |

## The auth model (important)

Two layers, both demonstrated by the client:

1. **API key** — every request carries your publishable key in `X-API-Key`.
   Reads (locations, tariffs, chargers, payment config) work with just this.
2. **Driver JWT** — driver-scoped writes (reserve, start/stop, set a limit,
   manage vehicles/favorites/notifications) additionally carry the driver's
   access token in `Authorization: Bearer …`. The client captures it on `login()`
   and attaches it automatically, along with the driver's `tokenUid` (the
   `idTag` used to authorize charging).

## Per-network capabilities

Some capabilities (e.g. **Vehicles**, **Favorites**) are toggled per network from
Command Center and may be off. Those calls return `403 feature_disabled`; the
demo notes and skips them. Your app should do the same — treat the capability set
as runtime-discoverable, not assumed.

## Payment is configurable

`GET /payments/config` reports the network's `paymentMode`:

- `self_managed` — the operator collects payment themselves; Phevnix never
  charges the driver. Handle payment in your own app.
- `phevnix_managed` — the operator opted into Phevnix billing; the config returns
  the public provider details to collect payment.

Phevnix billing is **optional** by design — encouraged, never forced.

## Run it

Requires **Node 20+** (uses global `fetch` and native TypeScript stripping).

```bash
cp .env.example .env       # then fill in EMSP_API_KEY + driver credentials
npm install                # dev-only: typescript + @types/node

# type-check the client
npm run typecheck

# run the end-to-end demo (loads .env)
node --env-file=.env --experimental-strip-types src/demo.ts
```

First run? Set `REGISTER=true` in `.env` to create the driver before login.

Point `EMSP_BASE_URL` at the lab (`https://api.phevnix.cloud`) for safe,
non-production testing, or `https://api-v2.phevnix.com` for production.

## Using the client in your own app

```ts
import { PhevnixEmspClient } from './src/client.ts';

const phevnix = new PhevnixEmspClient({
  baseUrl: 'https://api-v2.phevnix.com',
  apiKey: process.env.EMSP_API_KEY!,
});

await phevnix.login(email, password);                  // captures driver JWT + idTag
const near = await phevnix.searchLocations(18.42, -66.07, 25);
const session = await phevnix.startCharging({ chargerId });
await phevnix.setChargingLimit(chargerId, { unit: 'A', limit: 16 });
await phevnix.stopCharging((session as any).id);
```

## License

MIT — see [LICENSE](LICENSE).
