// Minimal OCPP 1.6J charge-point simulator — brings a REAL charger online against a CSMS so
// you can drive your app's full Start → charge → Stop flow without hardware.
//
//   CSMS_WS   the CSMS OCPP 1.6 endpoint WITHOUT the station id (default: the Phevnix lab)
//   CP_ID     the charge-point id to connect as — must be a charger that exists on your network
//             so the eMSP API can see it. The sim connects to `${CSMS_WS}/${CP_ID}`.
//
//   node tools/ocpp-sim.mjs
//   CSMS_WS=wss://csms.example.com/ocpp CP_ID=CP-01 node tools/ocpp-sim.mjs
//
// Responds to RemoteStart/Stop, ReserveNow, SetChargingProfile, TriggerMessage, UnlockConnector;
// streams MeterValues while charging; auto-reconnects if the socket drops. See tools/README.md.
import WebSocket from 'ws';

const CSMS = process.env.CSMS_WS || 'ws://csms.phevnix.cloud/ocpp';
const CP_ID = process.env.CP_ID || '633951';
const URL = `${CSMS}/${CP_ID}`;

const VOLTAGE = 230;
const AMPS = 32;
let limitA = AMPS;
let meterWh = 0;
let txId = null;
let connStatus = 'Available';
let ws = null;
let meterTimer = null;
let hbTimer = null;
let keepAliveTimer = null;
let reconnectTimer = null;
const pending = new Map();

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const uid = () => Math.random().toString(36).slice(2, 12);

function send(arr) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(arr)); }
function call(action, payload) {
  const id = uid(); pending.set(id, action);
  send([2, id, action, payload]);
  log(`→ ${action}`, JSON.stringify(payload).slice(0, 110));
  return id;
}
function reply(id, payload) { send([3, id, payload]); }

function status(connectorId, st) {
  if (connectorId === 1) connStatus = st;
  call('StatusNotification', { connectorId, errorCode: 'NoError', status: st, timestamp: new Date().toISOString() });
}

function startMeterLoop() {
  stopMeterLoop();
  meterTimer = setInterval(() => {
    if (txId == null) return;
    const p = VOLTAGE * limitA;
    meterWh += (p * 10) / 3600;
    call('MeterValues', { connectorId: 1, transactionId: txId, meterValue: [{
      timestamp: new Date().toISOString(),
      sampledValue: [
        { value: Math.round(meterWh).toString(), measurand: 'Energy.Active.Import.Register', unit: 'Wh' },
        { value: p.toString(), measurand: 'Power.Active.Import', unit: 'W' },
        { value: limitA.toString(), measurand: 'Current.Import', unit: 'A' },
        { value: VOLTAGE.toString(), measurand: 'Voltage', unit: 'V' },
      ],
    }]});
  }, 10_000);
}
function stopMeterLoop() { if (meterTimer) clearInterval(meterTimer); meterTimer = null; }

function connect() {
  log(`connecting → ${URL}`);
  ws = new WebSocket(URL, ['ocpp1.6']);

  ws.on('open', () => {
    log('WS open');
    call('BootNotification', { chargePointVendor: 'Phevnix', chargePointModel: 'Voltway Demo AC', chargePointSerialNumber: CP_ID, firmwareVersion: '1.0.0' });
    clearInterval(keepAliveTimer);
    keepAliveTimer = setInterval(() => { try { ws.ping(); } catch {} }, 20_000); // WS-level keepalive
  });

  ws.on('pong', () => { /* socket is alive */ });

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
    const type = msg[0];
    if (type === 3) {
      const action = pending.get(msg[1]); pending.delete(msg[1]);
      if (action === 'BootNotification') {
        log('✓ Boot accepted — Available');
        status(0, 'Available'); status(1, txId != null ? 'Charging' : 'Available');
        clearInterval(hbTimer); hbTimer = setInterval(() => call('Heartbeat', {}), 30_000);
        if (txId != null) startMeterLoop(); // resume metering after a reconnect
      }
      if (action === 'StartTransaction') {
        txId = msg[2]?.transactionId ?? Math.floor(Math.random() * 100000);
        log(`✓ Transaction ${txId} started — charging`); status(1, 'Charging'); startMeterLoop();
      }
      if (action === 'StopTransaction') { log('✓ Transaction stopped'); txId = null; status(1, 'Available'); }
      return;
    }
    if (type === 2) {
      const [, id, action, payload] = msg;
      log(`← ${action}`, JSON.stringify(payload).slice(0, 130));
      switch (action) {
        case 'ReserveNow': reply(id, { status: 'Accepted' }); status(1, 'Reserved'); break;
        case 'CancelReservation': reply(id, { status: 'Accepted' }); status(1, 'Available'); break;
        case 'RemoteStartTransaction': {
          reply(id, { status: 'Accepted' }); status(1, 'Preparing');
          const idTag = payload?.idTag || 'VOLTWAY';
          setTimeout(() => call('StartTransaction', { connectorId: payload?.connectorId || 1, idTag, meterStart: Math.round(meterWh), timestamp: new Date().toISOString() }), 800);
          break;
        }
        case 'RemoteStopTransaction':
          reply(id, { status: 'Accepted' }); stopMeterLoop();
          if (txId != null) call('StopTransaction', { transactionId: txId, meterStop: Math.round(meterWh), timestamp: new Date().toISOString(), reason: 'Remote' });
          break;
        case 'SetChargingProfile': {
          const lim = payload?.csChargingProfiles?.chargingSchedule?.chargingSchedulePeriod?.[0]?.limit;
          if (lim != null) { limitA = Math.max(6, Math.min(32, Number(lim))); log(`  set limit → ${limitA} A`); }
          reply(id, { status: 'Accepted' }); break;
        }
        case 'ClearChargingProfile': limitA = AMPS; reply(id, { status: 'Accepted' }); break;
        case 'TriggerMessage': reply(id, { status: 'Accepted' }); if (payload?.requestedMessage === 'StatusNotification') status(1, connStatus); break;
        case 'UnlockConnector': reply(id, { status: 'Unlocked' }); break;
        case 'GetConfiguration': reply(id, { configurationKey: [{ key: 'NumberOfConnectors', readonly: true, value: '1' }], unknownKey: [] }); break;
        default: reply(id, { status: 'Accepted' });
      }
    }
  });

  ws.on('close', (c) => {
    log(`WS closed (${c}) — reconnecting in 2s`);
    clearInterval(hbTimer); clearInterval(keepAliveTimer); stopMeterLoop();
    clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connect, 2000);
  });
  ws.on('error', (e) => log('WS error:', e.message));
}

process.on('SIGINT', () => { clearTimeout(reconnectTimer); try { ws && ws.close(); } catch {} process.exit(0); });
connect();
