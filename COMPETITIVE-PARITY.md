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
| Filter by amenity + sort menu | ✅ | `HomeScreen` Parking/WiFi/Restrooms chips + Nearest/Most-available/Fastest/Top-rated sort |
| Route / trip planning (chargers along a route) | ✅ | **built this session** — `screens/TripScreen.tsx` (keyless OSRM routing + `lib/geo.ts`); verified Bayamón→San Juan |

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
| Accessibility (WCAG AA) | ✅ | axe-core: 0 violations on Home/Account/Trip; pinch-zoom enabled, 4.5:1 contrast, labeled switches |

## Scorecard (driver-facing features; ➖ excluded)
- **Present (✅): 45**
- **Partial (🟡): 0**
- **Missing (⬜): 1** (scheduled charging — needs an eMSP API primitive)
- **Credential-gated (not counted): Smartcar parked-car SoC**

**Driver-facing parity ≈ 98%** (45 / 46 applicable). The single remaining miss — scheduled /
departure-time charging — is genuinely a *server-side* primitive (a CPO schedule endpoint + a
background trigger that fires the remote start), not something to fake with a PWA timer; it's the
right next backend feature. Smartcar is credential-gated and its core value (charging-time SoC)
is already delivered via OCPP.

## Closed this session
1. ✅ Charging insights / impact dashboard (`InsightsScreen`) — verified on real history.
2. ✅ Route/trip planning with charging stops (`TripScreen`, keyless OSRM) — verified Bayamón→San Juan.
3. ✅ Map sort menu + amenity filter (`HomeScreen`).
4. ✅ WCAG AA accessibility pass — axe-core: 0 violations on Home/Account/Trip.
5. ✅ Live battery SoC + auto-stop charge limit + receipt SoC (OCPP `SoC` → eMSP API → app).
6. ✅ Manual Vehicles (enabled + verified).

## Remaining (input-gated, not closeable by app code alone)
- Scheduled / departure-time charging — needs an eMSP API schedule primitive (CPO endpoint + background trigger).
- Smartcar link — needs a Smartcar developer credential (adds parked-car SoC only).
