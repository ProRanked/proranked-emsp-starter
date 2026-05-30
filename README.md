# Voltway — a sample eMobility app on the Phevnix eMSP API

**Voltway** is a fictional EV-charging brand and a complete, runnable **driver app**
built entirely on the Phevnix **eMSP API** as a backend-as-a-service. It shows what a
customer (an eMSP / eMobility provider) can ship on top of Phevnix without running any
charging infrastructure of their own — just a publishable API key.

> Mobile-first React web app. The same typed SDK (`src/lib/phevnix.ts`) powers a React
> Native / Expo build for iOS & Android with no API changes — only the screens differ.

## Make it yours (vibe-code your own app)

This repo is a **starter kit**. To build your own eMobility app:

1. **Get a publishable key** — Portal → Developer → create an eMSP (publishable) key. It
   starts with `phx_`, is read-only until a driver logs in, and is safe to ship in a client app.
2. **Drop it in** — `cp .env.example .env`, set `VITE_EMSP_API_KEY=phx_…`, `npm install`,
   `npm run dev`. That's it — the app is now running on *your* network's data.
3. **Re-skin and remix** — change the brand in `src/styles.css` + `AuthScreen`, keep or
   replace any screen. Every API call lives in one typed file: [`src/lib/phevnix.ts`](src/lib/phevnix.ts).
   That file *is* the SDK and the complete API reference — every `/emsp/v1` endpoint is a method.

**Vibe-coding with an LLM?** Point it at `src/lib/phevnix.ts` and paste a prompt like:

> "Using the `PhevnixEmspClient` in `src/lib/phevnix.ts`, build me a screen that lists the
> driver's reservations and lets them cancel one. Match the design system in `src/components/ui.tsx`."

The client handles the hard parts for you: the publishable-key + driver-JWT two-layer auth,
**silent token refresh** on expiry, response unwrapping, and typed errors (`PhevnixApiError`
with `.errorCode` like `feature_disabled`). You write screens; it talks to the API.

## What it demonstrates

A real driver journey, every screen backed by a live `/emsp/v1` call:

| Screen | eMSP API |
|---|---|
| **Sign up / sign in** | `POST /auth/driver/register` · `login` (captures the driver JWT + charge-token `idTag`) |
| **Chargers near you** | `GET /locations/search` (geo) → falls back to `/locations` |
| **Site detail** | `GET /locations/{id}` · `/locations/{id}/chargers` (live status) |
| **Charger** | `GET /chargers/{id}` + `/tariffs` → connector picker, **Start** & **Reserve** |
| **Active session** | `GET /charging/sessions` (live kWh/kW/cost) + a **charging-speed slider** → `PUT /smart-charging/{id}/limit` |
| **Reservations** | `GET` / `DELETE /reservations` |
| **Saved places** | `GET` / `POST` / `DELETE /favorites` |
| **Account** | `GET`/`PUT /notifications/preferences` · `GET /payments/config` |

### Two things worth seeing

- **Per-network capabilities.** Favorites is disabled on the demo network, so the app
  shows a friendly "*Saved places aren't enabled yet — can be enabled any time, no app
  update needed*" instead of an error. Capabilities are runtime-discovered (a `403
  feature_disabled` is handled, never assumed away).
- **Configurable payments.** The Account screen reflects the network's `paymentMode`:
  `self_managed` → "*Billed directly by your provider*" (Phevnix never charges the
  driver); `phevnix_managed` → "*Add a payment method*". Phevnix billing is optional by
  design — encouraged, never forced.

## Run it

Requires **Node 20+**.

```bash
cp .env.example .env        # set VITE_EMSP_API_KEY (publishable phx_… key)
npm install
npm run dev                 # → http://localhost:5173
```

Vite proxies `/emsp/*` to the gateway (`VITE_EMSP_BASE_URL`, default the lab
`https://api.phevnix.cloud`), so there's no CORS to configure in dev. On first run, tap
**Create one** to register a driver, then you're in.

```bash
npm run build               # type-check + production bundle
```

## How auth works (the important bit)

Two layers, both handled by [`PhevnixEmspClient`](src/lib/phevnix.ts):

1. **Publishable API key** in `X-API-Key` on every request — read-only, safe to ship in a
   client app.
2. **Driver JWT** in `Authorization: Bearer …` for driver-scoped writes (reserve,
   start/stop, set a limit, manage favorites/notifications). Captured on `login()`, along
   with the driver's charge-token `idTag`, and attached automatically.

## Project layout

```
src/
  lib/phevnix.ts     ← the SDK: a typed client for the whole eMSP API
  lib/types.ts       ← response shapes the app reads
  context/           ← PhevnixProvider (client + driver session, persisted)
  components/        ← design system (Button, Card, StatusPill, BottomNav, …)
  screens/           ← Auth, Home, Location, Charger, Session, Reservations, Favorites, Account
examples/
  cli-demo.ts        ← a headless end-to-end walk of the same API (great for testing)
```

The CLI demo is a quick way to exercise every endpoint from a terminal:

```bash
EMSP_API_KEY=phx_… DRIVER_EMAIL=you@example.test DRIVER_PASSWORD=… REGISTER=true \
  node --experimental-strip-types examples/cli-demo.ts
```

## Taking it to iOS & Android

`src/lib/phevnix.ts` is dependency-free and runtime-agnostic (global `fetch`). Drop it into
a React Native / Expo app and reuse it verbatim — only the screen components change.

## License

MIT — see [LICENSE](LICENSE).
