# `tools/` — OCPP charger simulator

To test a driver app you need an **online charger**. In production your operator's real
hardware provides that; while building, `ocpp-sim.mjs` gives you a real one on your laptop.

It's a ~150-line **OCPP 1.6J** charge point that connects to a CSMS over WebSocket, sends
`BootNotification` → `StatusNotification(Available)` → `Heartbeat`, and responds to the
commands your app triggers:

| Your app does | OCPP command the sim handles | Sim does |
|---|---|---|
| Start charging | `RemoteStartTransaction` | `StartTransaction` → streams `MeterValues` (live kWh/kW) |
| Stop charging | `RemoteStopTransaction` | `StopTransaction` |
| Reserve | `ReserveNow` / `CancelReservation` | sets connector Reserved/Available |
| Set charging speed | `SetChargingProfile` | throttles the simulated current |
| Unlock / Trigger | `UnlockConnector` / `TriggerMessage` | acknowledges |

It auto-reconnects if the socket drops, so the charger stays online while you click around.

## Run it

```bash
npm install                 # installs ws (a devDependency)

# Defaults to the Phevnix lab CSMS + charge point 633951:
npm run sim

# Or point it at your own CSMS and a charge point that exists on your network:
CSMS_WS=wss://csms.example.com/ocpp CP_ID=CP-01 npm run sim
```

| Env var | Meaning | Default |
|---|---|---|
| `CSMS_WS` | CSMS OCPP 1.6 endpoint, **without** the station id | `ws://csms.phevnix.cloud/ocpp` |
| `CP_ID` | the charge-point id to connect as | `633951` |

The sim connects to `${CSMS_WS}/${CP_ID}`.

## Two things to know

1. **The charge point must exist on your network.** A driver app lists chargers for *its*
   network, so the `CP_ID` you simulate has to be a charger your operator has provisioned —
   otherwise the eMSP API won't return it and your app won't see it. (`633951` is a Phevnix
   lab charger set up for exactly this.)
2. **If a command fails with "the charger isn't reachable,"** the charger is offline — start
   the sim (or check it's still connected). A charging command can only reach a charger that
   currently holds a live WebSocket to the CSMS.

## Typical loop

```bash
npm run sim &        # charger comes online
npm run dev          # open the app, sign in, find the charger, Start charging
                     # → watch the sim log stream MeterValues, Stop from the app
```
