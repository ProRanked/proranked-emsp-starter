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
  maxPowerKw?: number;
  connectorTypes?: string[];
  images?: { url?: string; thumbnailUrl?: string }[];
  hasParking?: boolean;
  hasRestrooms?: boolean;
  hasWifi?: boolean;
  phone?: string;
  ratingAverage?: number | null;
  ratingCount?: number;
  openingHours?: {
    twentyFourSeven: boolean;
    regular: { weekday: number; open: string; close: string }[];
  };
}

export interface LocationReview {
  id: string;
  rating: number;
  comment?: string | null;
  authorName?: string;
  isMine?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewsResponse {
  summary: { average: number; count: number };
  reviews: LocationReview[];
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
  /** Live EV battery State-of-Charge (0-100%), when the charger reports the OCPP SoC measurand. */
  currentSocPercent?: number;
  durationSeconds?: number;
  cost?: number;
  total?: number;
  currency?: string;
}

/**
 * The session's live EV battery State-of-Charge, or null when it shouldn't be shown.
 * Many chargers (most AC/Level-2 stations) never send the OCPP SoC measurand, and some send a
 * 0 placeholder — in both cases there's no real reading, so the whole battery UI must stay hidden
 * rather than show a misleading "0%". Treat only a present, positive value as a real reading.
 */
export function reportedSoc(s?: { currentSocPercent?: number } | null): number | null {
  const v = s?.currentSocPercent;
  return typeof v === 'number' && v > 0 ? v : null;
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
