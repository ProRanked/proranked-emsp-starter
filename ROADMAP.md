# Voltway → competitive-quality roadmap

Goal: keep improving this eMSP sample app until it competes with **ChargePoint,
ChargeLab, and Swtch** driver apps. It must stay the benchmark that proves the
Phevnix eMSP API is good enough for anyone to build a real charging app on.

## Where Voltway is today
Has: email auth, **real interactive station map** (✅ Phase 1), nearby-site list
with distance, charger detail, remote start/stop, live session (energy gauge +
charging-speed slider + stop), reserve-15-min, active-session resume banner,
basic account. Vehicles/Favorites screens exist but are capability-gated off.

## Gap analysis vs ChargePoint / ChargeLab / Swtch
What the pros have that we don't yet:

| Area | Pro apps | Voltway gap |
|---|---|---|
| Map | filters (connector/speed/price/available-now), real-time pin status, search-by-address, cluster | pins not status-colored; no filters/search; no clustering |
| Station detail | per-port live status, connector-type icons, pricing detail, photos, amenities, hours, directions, reviews | minimal detail, no pricing breakdown/amenities/directions |
| History | past sessions list, cost breakdown, **emailable/PDF receipts** | **missing entirely** |
| Payments | saved cards, wallet/auto-reload, payment history | none (API capability exists) |
| Notifications | charge-complete, idle-fee warning, unplug reminder (push) | none (API exists) |
| Reservations | list + cancel + reminders | start exists; no management UX |
| Vehicles | Smartcar link, SoC-aware | screen exists, gated off |
| Account | edit profile, payment methods, RFID/tokens | basic only |
| Polish | onboarding, skeletons, a11y, i18n (PR→Spanish), PWA install, offline | minimal |
| Trust | station reviews/ratings, report-an-issue | none |

## Phased plan
- **Phase 1 — Real map** ✅ DONE. Leaflet/OSM dark map, branded pins, deep-link popups, fit-to-bounds, invalid-coord guard. ✅ **Backend geocoding gap (#36) FIXED** — CPO now auto-geocodes locations created/updated without coords (Nominatim, best-effort, city-level fallback) + a replica-safe rate-limited backfill for existing coord-less sites. So new operator-added sites land on the map automatically.
- **Phase 2 — Charging history + receipts** ✅ DONE. Activity tab (history + lifetime summary), itemized Receipt screen (energy/duration/peak, start/end, charger, auth method, reconciled cost breakdown, share), and stop→receipt flow. (Surfaced a backend billing bug: session Total excludes SessionFees.)
- **Phase 3 — Map search + filters + status pins** 🔨 IN PROGRESS: ✅ search-by-address (Nominatim geocode → recenter map + recompute distances + back-to-home). ✅ availability-colored pins VERIFIED LIVE (green=free/amber=busy, available-count badge) via new API availableCount. ✅ filters: Available now + Fast + connector-type (CCS/Type 1/2/CHAdeMO) via new API maxPowerKw/connectorTypes. Phase 3 COMPLETE.
- **Phase 4 — Richer station detail** 🔨 IN PROGRESS: ✅ real street-level mini-map, ✅ Get Directions deep link, ✅ "X of Y available now" summary, ✅ friendly connector names (Type 1/2, CCS, CHAdeMO), ✅ pricing breakdown, ✅ **online-recency / reliability line** (green "Online · seen Nm ago" vs amber "Last seen …" from lastHeartbeat — the trust signal drivers care about most). TODO: amenities/hours.
- **Phase 4b — Live charging experience** ✅ DONE (2026-05-31, VERIFIED LIVE E2E through Orleans): ✅ **live charging power curve** (SVG area+line, peak/avg, pulsing head dot, sampled from currentPowerKw), ✅ **charge goal with live time-to-target** (target kWh → ETA from real power + progress bar + "Goal reached"), ✅ **persistent active-session bar** (live "Charging · N kWh · N kW · $N" strip on every tabbed screen, tap to resume — the ChargePoint/ChargeLab/Swtch pattern). Surfaced + fixed 3 live-session data bugs: currentPowerKw only on detail DTO not list (→ poll detail; also added to list DTO server-side, deployed), live cost read null .cost not .total, receipt energy double-counted bundled fees.
- **Phase 5 — Payments + notifications** 🔨 IN PROGRESS: ✅ **in-app notifications** — toast system fires "Charging started"/"Charging complete · N kWh · $N · tap for receipt" from real session transitions, honoring the Account push-pref (the toggle now controls real behavior); route- + logout-gated. TODO: saved cards/wallet, payment history, OS-level web push (VAPID). ✅ **proactive token refresh** — renew ~90s before the 15-min access token expires so long charges (>15 min) never hit a mid-session 401/logout. (Investigated the token model: it's sound — access 15-min stateless JWT, single-use rotating refresh token, refresh endpoint works; the logouts I saw while testing were a shared-driver/reload artifact, not a product bug. Proactive refresh shipped as hardening regardless.)
- **Phase 6 — Vehicles + Favorites + Reservations UX** 🔨 IN PROGRESS: ✅ Favorites enabled + working (Saved tab + heart-save on locations). TODO: Vehicles (needs Smartcar integration), reservations management polish.
- **Phase 7 — Polish & trust** 🔨 IN PROGRESS: ✅ skeleton loaders (Home/Activity/Location), ✅ error/retry states, ✅ installable PWA (manifest + service worker + icon + Apple meta). ✅ onboarding, ✅ a11y pass (focus-visible rings + aria-labels on icon buttons/slider/search). ✅ **full Spanish i18n** (en/es framework + language toggle; ALL screens translated incl. session/charger/location/activity/receipt/favorites/reservations/vehicles — device-default, persisted; VERIFIED LIVE). TODO: station reviews + report-issue (need backend).

Each phase that needs data the eMSP API doesn't expose yet becomes a backend task
too — the app is also a forcing function for API completeness (e.g. geocoding,
per-location availability counts, receipt endpoints).
