# Voltway — Competitive Parity Audit

Honest, code-grounded comparison of the Voltway sample app against the standard premium
driver-app feature set (ChargePoint, ChargeLab, Swtch, PlugShare, EVgo, Electrify America,
Tesla). Each row cites the file that implements it. Updated 2026-05-31.

**Legend:** ✅ Present · 🟡 Partial · ⬜ Missing · ➖ N/A for this app's model

> Voltway is a *reference app on the Phevnix eMSP API* (`/emsp/v1/*`). Its purpose is to
> prove a third-party developer can build a premium charging app on the API. "Parity" is
> measured against what a driver expects, not against an operator console.

## A — Discovery & Map
| Feature | Status | Evidence |
|---|---|---|
| Interactive station map | ✅ | `components/LiveMap.tsx`, `screens/HomeScreen.tsx` |
| Current-location centering | ✅ | `HomeScreen` geolocation `center` |
| Search by city / address (geocoded) | ✅ | `HomeScreen` Nominatim search |
| Filter: available now | ✅ | `HomeScreen` `onlyAvailable` |
| Filter: fast charging (≥50 kW) | ✅ | `HomeScreen` `onlyFast` |
| Filter: connector type | ✅ | `HomeScreen` `connFilter` chips |
| Live availability counts | ✅ | `availableCount` on location list |
| Station detail (connectors, status, pricing) | ✅ | `screens/LocationScreen.tsx` |
| Station photos | ✅ | `LocationScreen` image strip |
| Amenities + opening hours | ✅ | `LocationScreen` amenity chips / `hoursLabel` |
| Get directions (open in maps) | ✅ | `LocationScreen` "Get directions" |
| Reviews & ratings | ✅ | `LocationScreen` LocationReviews |
| Report an issue | ✅ | `LocationScreen` ReportIssue |
| Filter by amenity / sort menu | 🟡 | availability/speed/connector only; no amenity filter or sort menu |
| Route / trip planning (chargers along a route) | ⬜ | needs routing provider; not built |

## B — Charging
| Feature | Status | Evidence |
|---|---|---|
| Remote start / stop | ✅ | `screens/ChargerScreen.tsx`, `SessionScreen.tsx` |
| Live session (energy, power, cost, time) | ✅ | `SessionScreen` |
| Live battery SoC | ✅ | `SessionScreen` Battery card (OCPP SoC → eMSP `currentSocPercent`) |
| Live charging power curve | ✅ | `components/PowerCurve.tsx` |
| Charge limit — auto-stop at target % | ✅ | `SessionScreen` Charge limit (verified auto-stop at 80%) |
| Charge goal (kWh target + ETA) | ✅ | `SessionScreen` Charge goal |
| Connector unlock / trigger | ✅ | SDK `unlockConnector` / `triggerMessage` |
| Reservations | ✅ | `screens/ReservationsScreen.tsx` |
| Charging history | ✅ | `screens/ActivityScreen.tsx` |
| Itemized receipts (+ share) | ✅ | `screens/ReceiptScreen.tsx` |
| Scheduled / departure-time charging | ⬜ | not built (eMSP API has no schedule primitive yet) |
| Charging insights / impact dashboard | ⬜→✅ | **built this session** — `screens/InsightsScreen.tsx` |

## C — Payments
| Feature | Status | Evidence |
|---|---|---|
| Pre-charge cost estimate | ✅ | SDK `estimateCost`, `ChargerScreen` pricing |
| Pricing transparency | ✅ | `ChargerScreen` / `LocationScreen` |
| Saved payment methods | ➖ | Voltway network = `self_managed`; billing handled by operator (`AccountScreen`) |
| Phevnix-managed wallet path | ✅ (code) | `AccountScreen` `phevnix_managed` branch + SDK `getPaymentMethods`/`checkout` |

## D — Account & Personalization
| Feature | Status | Evidence |
|---|---|---|
| Profile | ✅ | `screens/AccountScreen.tsx` |
| My Vehicles (add/list/remove) | ✅ | `screens/VehiclesScreen.tsx` (verified live) |
| Favorites | ✅ | `screens/FavoritesScreen.tsx` |
| Notification preferences | ✅ | `AccountScreen` |
| Closed-app push (Web Push / VAPID) | ✅ | `lib/push.ts`, `public/sw.js` |
| Charge tag (RFID) display | ✅ | `AccountScreen` |
| Lifetime stats (sessions/kWh/$) | ✅ | `AccountScreen`, `ActivityScreen` |
| Multi-language (EN/ES) | ✅ | `lib/i18n.tsx` |
| Smartcar vehicle link (SoC for parked cars) | ⬜ | credential-gated; live-charging SoC already covered via OCPP |

## E — Reliability & UX polish
| Feature | Status | Evidence |
|---|---|---|
| PWA / installable / offline shell | ✅ | `public/sw.js`, manifest |
| Onboarding | ✅ | onboarding flow + `voltway.onboarded` |
| Persistent active-session bar | ✅ | `components/AppLayout.tsx` |
| Session resume on reload/login | ✅ | provider `fetchActiveSession` |
| Loading / skeleton / empty / error+retry states | ✅ | `components/ui.tsx` (Skeleton/Empty/Error) |
| In-app + OS notifications on session events | ✅ | `context/PhevnixProvider.tsx`, `osNotify` |
| Proactive token refresh | ✅ | SDK `scheduleProactiveRefresh` |
| Accessibility (aria labels, keyboard) | 🟡 | aria labels present; not audited against WCAG |

## Scorecard (driver-facing features; ➖ excluded)
- **Present (✅): 41**
- **Partial (🟡): 2** (map sort/amenity filter, a11y audit)
- **Missing (⬜): 3** (route planning, scheduled charging, Smartcar parked-car SoC)

**Driver-facing parity ≈ 89%** (41 / 46 applicable). The three misses are: one credential-gated
(Smartcar — and its core value, charging-time SoC, is already delivered via OCPP), one needs an
external routing provider (trip planning), one needs an API primitive (scheduled charging).

## Honest gaps & next candidates (buildable + verifiable)
1. ~~Charging insights / impact dashboard~~ — **DONE this session** (`InsightsScreen`), verified on real history.
2. Scheduled / departure-time charging — app-side delayed start is fragile for a PWA; better as an eMSP API primitive. Deferred pending API support.
3. Route/trip planning with charging stops — needs a routing provider (ORS/Mapbox); larger effort.
4. Map sort menu + amenity filter — minor polish.
5. WCAG/a11y pass — minor polish.
6. Smartcar link — credential-gated (parked-car SoC only).
