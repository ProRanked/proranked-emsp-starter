/**
 * PhevnixEmspClient — a small, dependency-free reference client for the Phevnix
 * eMSP API (`/emsp/v1`). It demonstrates the two-layer auth model:
 *
 *   1. Every request carries your publishable eMSP API key in `X-API-Key`.
 *   2. Driver-scoped writes (reserve, start/stop, set a charging limit, manage
 *      vehicles/favorites/notifications) additionally carry the driver's JWT in
 *      `Authorization: Bearer <accessToken>`, obtained from driver login.
 *
 * Reads work with just the API key. The client auto-attaches the driver JWT once
 * you've logged in. No SDK, no build step required — Node 20+ global `fetch`.
 */

export interface PhevnixEmspClientOptions {
  /** Gateway base URL, e.g. https://api-v2.phevnix.com or https://api.phevnix.cloud (lab). */
  baseUrl: string;
  /** Your publishable eMSP API key (phx_...). Safe to ship in client apps. */
  apiKey: string;
  /** Optional: an existing driver access token to start authenticated. */
  accessToken?: string;
}

export class PhevnixApiError extends Error {
  readonly status: number;
  readonly errorCode: string | undefined;
  readonly body: unknown;

  constructor(status: number, errorCode: string | undefined, message: string, body: unknown) {
    super(message);
    this.name = 'PhevnixApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.body = body;
  }
}

export interface DriverSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  driver: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    /** The charge-token UID used as `idTag` when reserving/starting a session. */
    tokenUid: string;
  };
}

type Query = Record<string, string | number | boolean | undefined>;

export class PhevnixEmspClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private accessToken?: string;
  private refreshToken?: string;
  /** Captured at login — the idTag to authorize charging on this driver's behalf. */
  tokenUid?: string;

  constructor(opts: PhevnixEmspClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.accessToken = opts.accessToken;
  }

  get isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // ── Core request helper ────────────────────────────────────────────────

  private async request<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    const headers: Record<string, string> = { 'X-API-Key': this.apiKey };
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    const text = await res.text();
    const json = text ? safeParse(text) : null;

    if (!res.ok) {
      const code = (json as any)?.error ?? (json as any)?.errorCode;
      const message = (json as any)?.message ?? (json as any)?.detail ?? `HTTP ${res.status}`;
      throw new PhevnixApiError(res.status, code, message, json ?? text);
    }
    // The CPO wraps some responses as { data, success, ... }; unwrap when present.
    if (json && typeof json === 'object' && 'data' in (json as any) && 'success' in (json as any)) {
      return (json as any).data as T;
    }
    return json as T;
  }

  // ── Driver auth ────────────────────────────────────────────────────────

  async register(input: { email: string; password: string; firstName: string; lastName: string; phone?: string }): Promise<unknown> {
    return this.request('POST', '/emsp/v1/auth/driver/register', { body: input });
  }

  async login(email: string, password: string): Promise<DriverSession> {
    const session = await this.request<DriverSession>('POST', '/emsp/v1/auth/driver/login', { body: { email, password } });
    this.accessToken = session.accessToken;
    this.refreshToken = session.refreshToken;
    this.tokenUid = session.driver?.tokenUid;
    return session;
  }

  async refresh(): Promise<DriverSession> {
    if (!this.refreshToken) throw new Error('No refresh token — call login() first.');
    const session = await this.request<DriverSession>('POST', '/emsp/v1/auth/driver/refresh', { body: { refreshToken: this.refreshToken } });
    this.accessToken = session.accessToken;
    this.refreshToken = session.refreshToken ?? this.refreshToken;
    return session;
  }

  me(): Promise<unknown> {
    return this.request('GET', '/emsp/v1/auth/driver/me');
  }

  // ── Discovery: locations, chargers, tariffs ────────────────────────────

  listLocations(query: { city?: string; q?: string; page?: number; pageSize?: number } = {}): Promise<unknown> {
    return this.request('GET', '/emsp/v1/locations', { query });
  }

  /** Geo-search: locations within `radiusKm` of a point, nearest first (distanceKm per result). */
  searchLocations(lat: number, lng: number, radiusKm = 10, limit = 25): Promise<unknown> {
    return this.request('GET', '/emsp/v1/locations/search', { query: { lat, lng, radiusKm, limit } });
  }

  getLocation(id: string): Promise<unknown> {
    return this.request('GET', `/emsp/v1/locations/${id}`);
  }

  getLocationChargers(id: string): Promise<unknown> {
    return this.request('GET', `/emsp/v1/locations/${id}/chargers`);
  }

  listChargers(query: { page?: number; pageSize?: number } = {}): Promise<unknown> {
    return this.request('GET', '/emsp/v1/chargers', { query });
  }

  getCharger(id: string): Promise<unknown> {
    return this.request('GET', `/emsp/v1/chargers/${id}`);
  }

  listTariffs(query: { activeOnly?: boolean; page?: number; pageSize?: number } = {}): Promise<unknown> {
    return this.request('GET', '/emsp/v1/tariffs', { query });
  }

  /** Estimate the cost of a session before you start (energy + time + fees). */
  estimateCost(input: { tariffId: string; energyKwh: number; durationMinutes: number }): Promise<unknown> {
    return this.request('POST', '/emsp/v1/pricing/calculate', { body: input });
  }

  // ── Reservations (driver) ──────────────────────────────────────────────

  reserve(input: { chargerId: string; connectorNumber?: number; idTag?: string; expiryMinutes?: number }): Promise<unknown> {
    return this.request('POST', '/emsp/v1/reservations', {
      body: { connectorNumber: 1, idTag: this.requireIdTag(input.idTag), ...input },
    });
  }

  listReservations(query: { status?: string; page?: number; pageSize?: number } = {}): Promise<unknown> {
    return this.request('GET', '/emsp/v1/reservations', { query });
  }

  cancelReservation(id: string): Promise<unknown> {
    return this.request('DELETE', `/emsp/v1/reservations/${id}`);
  }

  // ── Charging (driver) ──────────────────────────────────────────────────

  startCharging(input: { chargerId: string; connectorNumber?: number; idTag?: string }): Promise<unknown> {
    return this.request('POST', '/emsp/v1/charging/start', {
      body: { connectorNumber: 1, idTag: this.requireIdTag(input.idTag), ...input },
    });
  }

  stopCharging(sessionId: string): Promise<unknown> {
    return this.request('POST', '/emsp/v1/charging/stop', { body: { sessionId } });
  }

  listSessions(query: { status?: string; page?: number; pageSize?: number } = {}): Promise<unknown> {
    return this.request('GET', '/emsp/v1/charging/sessions', { query });
  }

  // ── Smart charging (driver) ────────────────────────────────────────────

  getChargingLimit(chargerId: string, connector = 1, unit: 'A' | 'W' = 'A'): Promise<unknown> {
    return this.request('GET', `/emsp/v1/smart-charging/${chargerId}/limit`, { query: { connector, unit } });
  }

  setChargingLimit(chargerId: string, input: { connectorNumber?: number; unit?: 'A' | 'W'; limit: number }): Promise<unknown> {
    return this.request('PUT', `/emsp/v1/smart-charging/${chargerId}/limit`, { body: input });
  }

  clearChargingLimit(chargerId: string, connector = 1): Promise<unknown> {
    return this.request('DELETE', `/emsp/v1/smart-charging/${chargerId}/limit`, { query: { connector } });
  }

  // ── Remote control (driver) ────────────────────────────────────────────

  unlockConnector(chargerId: string, connectorNumber = 1): Promise<unknown> {
    return this.request('POST', `/emsp/v1/remote-control/${chargerId}/unlock`, { body: { connectorNumber } });
  }

  triggerMessage(chargerId: string, message: string, connectorNumber?: number): Promise<unknown> {
    return this.request('POST', `/emsp/v1/remote-control/${chargerId}/trigger`, { body: { message, connectorNumber } });
  }

  // ── Notifications (driver) ─────────────────────────────────────────────

  getNotificationPreferences(): Promise<unknown> {
    return this.request('GET', '/emsp/v1/notifications/preferences');
  }

  updateNotificationPreferences(prefs: Record<string, boolean | string>): Promise<unknown> {
    return this.request('PUT', '/emsp/v1/notifications/preferences', { body: prefs });
  }

  // ── Vehicles (driver; capability may be disabled per network) ──────────

  listVehicles(): Promise<unknown> {
    return this.request('GET', '/emsp/v1/vehicles');
  }

  addVehicle(input: { make?: string; model?: string; year?: number; color?: string; vin?: string; licensePlate?: string; batteryCapacityKwh?: number }): Promise<unknown> {
    return this.request('POST', '/emsp/v1/vehicles', { body: input });
  }

  removeVehicle(id: string): Promise<unknown> {
    return this.request('DELETE', `/emsp/v1/vehicles/${id}`);
  }

  // ── Favorites (driver; capability may be disabled per network) ─────────

  listFavorites(): Promise<unknown> {
    return this.request('GET', '/emsp/v1/favorites');
  }

  addFavorite(input: { targetType: 'location' | 'charger'; targetId: string; label?: string }): Promise<unknown> {
    return this.request('POST', '/emsp/v1/favorites', { body: input });
  }

  removeFavorite(id: string): Promise<unknown> {
    return this.request('DELETE', `/emsp/v1/favorites/${id}`);
  }

  // ── Payments (mode-aware per network) ──────────────────────────────────

  getPaymentConfig(): Promise<unknown> {
    return this.request('GET', '/emsp/v1/payments/config');
  }

  getPaymentMethods(): Promise<unknown> {
    return this.request('GET', '/emsp/v1/payments/methods');
  }

  checkout(input: { sessionId: string; amount?: number; currency?: string }): Promise<unknown> {
    return this.request('POST', '/emsp/v1/payments/checkout', { body: input });
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private requireIdTag(idTag?: string): string {
    const tag = idTag ?? this.tokenUid;
    if (!tag) throw new Error('No idTag — pass one or login() first to capture the driver tokenUid.');
    return tag;
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
