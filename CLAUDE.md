# Working in this repo (contract for coding agents)

This is a **driver-facing EV-charging app** built on the ProRanked **eMSP API**. It is a starter:
someone forked it to ship their own branded app. Your job is usually to re-skin it, add a screen, or
wire a new endpoint — not to rebuild it.

Read this before writing code. It exists because these are the things you cannot infer from the
source, and getting them wrong wastes a whole session.

## The API

```
Base URL   https://api.proranked.com
Paths      /emsp/v1/...          <- there is NO /api prefix
Auth       X-API-Key: <key>      <- on EVERY request
```

The key lives in `VITE_EMSP_API_KEY` (see `.env.example`). Publishable keys start with `pr_pk_`,
secret keys with `pr_sk_`. **Only a `pr_pk_` key belongs in this app** — it ships to the browser.
Never hardcode a key; never commit `.env`.

### The one rule agents get wrong: auth is two-part

| What you're doing | Headers required |
|---|---|
| Read public data — locations, chargers, tariffs | `X-API-Key` alone |
| **Driver actions** — start/stop a charge, account, payments, favourites | `X-API-Key` **and** `Authorization: Bearer <driver JWT>` |

The driver JWT comes from `POST /emsp/v1/auth/driver/login`. A request with only the API key
returns **403** on those endpoints — verified live. If you see a 403 on a start/stop call, you are
missing the driver token; do not "fix" it by switching keys or mocking the response.

## The SDK is the API reference

`src/lib/phevnix.ts` is a single typed client with **one method per endpoint** (~46 of them). It is
the contract. Before adding a call:

1. Look for an existing method there — it probably exists.
2. If it doesn't, check the spec: <https://docs.proranked.com/specs/openapi-emsp.json>
3. If it isn't in the spec either, **stop and say so.** Do not invent an endpoint.

## Response shapes

```jsonc
{ "data": …, "success": true, "timestamp": "…" }     // + "pagination" on lists
{ "error": "not_found", "code": "not_found", "message": "…" }   // errors
```

`POST /emsp/v1/charging/start` can return **402 Payment Required** — surface it as "add a payment
method". Don't retry it.

## Verify before you build

```bash
curl 'https://api.proranked.com/emsp/v1/locations?pageSize=1' -H "X-API-Key: $VITE_EMSP_API_KEY"
```

Expect `200` and `{"data": [...], "success": true}`.

**An empty `data: []` is a success, not a failure.** A new ProRanked account has no locations or
chargers yet, so most list endpoints legitimately return `[]`. That looks identical to a broken key —
so if you need to prove the credential itself works, call `/cpms/v1/me` with a CPMS key, or just
trust a `200`. Do not start mocking data because a list came back empty.

## Re-branding (the most common task)

- Colours, fonts, radii → `src/index.css` / the design tokens.
- Brand name + logo → `src/components/BrandLogo.tsx`, `src/context/BrandingProvider.tsx`.
- Screens live in `src/screens/`, shared pieces in `src/components/`.

Change tokens first. If you find yourself editing colours in individual screens, you're doing it the
hard way.

## Rules

- **Never mock the API or create fixture data** to make something look finished. If you're blocked
  on a 401/403/404, stop and report the exact status and body.
- Don't restructure the app or swap frameworks unless asked.
- Keep the typed client typed — no `any` on API responses.
- Docs index for anything not covered here: <https://docs.proranked.com/specs/llms.txt>
