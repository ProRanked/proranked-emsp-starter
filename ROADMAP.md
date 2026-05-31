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
- **Phase 1 — Real map** ✅ DONE. Leaflet/OSM dark map, branded pins, deep-link popups, fit-to-bounds, invalid-coord guard. (Surfaced + flagged the backend geocoding gap — locations ship null/0,0 coords.)
- **Phase 2 — Charging history + receipts**: a History tab (past sessions, energy/cost/duration), a session-receipt detail (itemized: energy, session fee, idle fee, tax, total), share/download. Highest-impact missing core feature.
- **Phase 3 — Map filters + search + status pins**: filter by connector/speed/available-now; search-by-address (geocode); color pins by real-time availability (needs availability counts in the locations payload).
- **Phase 4 — Richer station detail**: per-connector live status + type icons, pricing breakdown, directions, amenities/hours.
- **Phase 5 — Payments + notifications**: saved cards/wallet, payment history; notification preferences + charge-complete/idle push.
- **Phase 6 — Vehicles + Favorites + Reservations UX**: enable the gated capabilities, polish the management flows.
- **Phase 7 — Polish & trust**: onboarding, skeleton loaders, error/retry, a11y, Spanish i18n, PWA install, station reviews + report-issue.

Each phase that needs data the eMSP API doesn't expose yet becomes a backend task
too — the app is also a forcing function for API completeness (e.g. geocoding,
per-location availability counts, receipt endpoints).
