// Lightweight shapes for the eMSP API responses the app reads. The SDK returns `unknown`;
// the app casts to these at the call sites. Fields are optional/defensive on purpose — a
// real client shouldn't assume every field is present on every network.

export interface Driver {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tokenUid?: string;
}

export interface ChargerLite {
  id: string;
  serialNumber?: string;
  uid?: string;
  name?: string;
  status?: string;
  connectorCount?: number;
  maxPowerKw?: number;
}

export interface LocationLite {
  id: string;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  chargerCount?: number;
  availableCount?: number;
  images?: { url?: string; thumbnailUrl?: string }[];
}

export interface Tariff {
  id: string;
  name?: string;
  type?: string;
  currency?: string;
  isFree?: boolean;
  energyRate?: number;
  timeRate?: number;
  idleRate?: number;
  sessionFee?: number;
}

export interface Reservation {
  id: string;
  chargerId: string;
  connectorNumber: number;
  status: string;
  idTag: string;
  expiryDate: string;
  createdAt: string;
}

export interface ChargingSession {
  id?: string;
  status?: string;
  chargerId?: string;
  chargerUid?: string;
  connectorNumber?: number;
  locationName?: string;
  startTime?: string;
  endTime?: string;
  energyDeliveredKwh?: number;
  currentPowerKw?: number;
  durationSeconds?: number;
  cost?: number;
  total?: number;
  currency?: string;
}

/** Full session detail (GET /charging/sessions/:id) — itemized for the receipt. */
export interface ChargingSessionDetail extends ChargingSession {
  authMethod?: string;
  maxPowerKw?: number;
  idleTimeSeconds?: number;
  stopReason?: string;
  costs?: {
    subtotal?: number;
    taxes?: number;
    sessionFees?: number;
    idleFees?: number;
    total?: number;
    currency?: string;
  };
}

export interface NotificationPreferences {
  channels: { push: boolean; email: boolean; sms: boolean };
  events: {
    sessionStarted: boolean;
    sessionStopped: boolean;
    sessionFailed: boolean;
    reservationReminder: boolean;
    payment: boolean;
  };
  contact: { email?: string | null; phoneNumber?: string | null };
}

export interface PaymentConfig {
  paymentMode: 'self_managed' | 'phevnix_managed';
  phevnixBillingAvailable?: boolean;
  provider?: string;
  currency?: string;
  note?: string;
}

/** Some list endpoints return a bare array, others { data: [...] } or { items: [...] }. */
export function asArray<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const r = result as { data?: unknown; items?: unknown } | null;
  if (r && Array.isArray(r.data)) return r.data as T[];
  if (r && Array.isArray(r.items)) return r.items as T[];
  return [];
}
