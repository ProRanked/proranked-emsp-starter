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
  /** Fired whenever the access/refresh tokens change (login, register, silent refresh) so a host
   *  app can persist them. The driver access token is short-lived (~15 min) — the client refreshes
   *  it automatically on a 401, but the host should persist the rotated tokens to survive reloads. */
  onTokensChanged?: (tokens: { accessToken?: string; refreshToken?: string; tokenUid?: string }) => void;
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
  private readonly onTokensChanged?: PhevnixEmspClientOptions['onTokensChanged'];
  private refreshing?: Promise<void>;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  /** Captured at login — the idTag to authorize charging on this driver's behalf. */
  tokenUid?: string;

  constructor(opts: PhevnixEmspClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.accessToken = opts.accessToken;
    this.onTokensChanged = opts.onTokensChanged;
  }

  private emitTokens(): void {
    this.onTokensChanged?.({ accessToken: this.accessToken, refreshToken: this.refreshToken, tokenUid: this.tokenUid });
  }

  /**
   * Renew the access token shortly *before* it expires. Charging sessions run far longer
   * than the 15-min token life, so relying only on reactive 401-refresh risks a hiccup (or
   * a rotation race) mid-charge. We read the token's own `exp` and schedule a refresh ~90s
   * early, routed through ensureRefreshed() so it can't double-spend a single-use refresh
   * token alongside a reactive refresh. A failed proactive refresh is non-fatal — the next
   * request still falls back to the reactive path.
   */
  private scheduleProactiveRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    if (!this.refreshToken || !this.accessToken) return;
    const exp = decodeJwtExpMs(this.accessToken);
    if (exp == null) return;
    const lead = 90_000; // refresh 90s before expiry
    const delay = Math.max(5_000, exp - Date.now() - lead);
    this.refreshTimer = setTimeout(() => {
      this.ensureRefreshed().catch(() => {
        /* non-fatal: reactive 401-refresh remains the backstop */
      });
    }, delay);
  }

  get isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /** Rehydrate a persisted driver session (e.g. from localStorage) after a reload. */
  restoreSession(s: { accessToken?: string; refreshToken?: string; tokenUid?: string }): void {
    if (s.accessToken) this.accessToken = s.accessToken;
    if (s.refreshToken) this.refreshToken = s.refreshToken;
    if (s.tokenUid) this.tokenUid = s.tokenUid;
    this.scheduleProactiveRefresh();
  }

  /** Drop all auth state (logout). */
  clearSession(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    this.accessToken = undefined;
    this.refreshToken = undefined;
    this.tokenUid = undefined;
  }

  get currentAccessToken(): string | undefined {
    return this.accessToken;
  }

  get currentRefreshToken(): string | undefined {
    return this.refreshToken;
  }

  // ── Core request helper ────────────────────────────────────────────────

  private async request<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}, _retried = false, _transientRetried = false): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    const headers: Record<string, string> = { 'X-API-Key': this.apiKey };
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await this.fetchWithTimeout(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (e) {
      // A timed-out or dropped connection would otherwise spin a screen forever. Retry once for an
      // idempotent read; for everything else surface a clean error (never an infinite spinner).
      if (method === 'GET' && !_transientRetried) {
        await delay(600);
        return this.request<T>(method, path, opts, _retried, true);
      }
      if (e instanceof PhevnixApiError) throw e;
      throw new PhevnixApiError(0, 'network_error', e instanceof Error ? e.message : 'Network error', null);
    }

    const text = await res.text();
    const json = text ? safeParse(text) : null;

    if (!res.ok) {
      const code = (json as any)?.error ?? (json as any)?.errorCode;
      // The driver access token expires (~15 min). When it lapses the API may answer 401, or — on
      // a write with a stale token downgraded to "no driver" — 403 public_key_write_denied /
      // driver_required. In all of these, transparently refresh once and retry so the app never
      // breaks mid-session. Auth endpoints themselves never recurse.
      const refreshable =
        res.status === 401 ||
        (res.status === 403 && (code === 'public_key_write_denied' || code === 'driver_required'));
      if (refreshable && !_retried && this.refreshToken && !path.startsWith('/emsp/v1/auth/driver')) {
        try {
          await this.ensureRefreshed();
          return this.request<T>(method, path, opts, true, _transientRetried);
        } catch {
          this.clearSession();
          this.emitTokens();
        }
      }
      // Transient gateway hiccups (502/503/504) — retry once for an idempotent read before giving up.
      if ((res.status === 502 || res.status === 503 || res.status === 504) && method === 'GET' && !_transientRetried) {
        await delay(600);
        return this.request<T>(method, path, opts, _retried, true);
      }
      const message = (json as any)?.message ?? (json as any)?.detail ?? `HTTP ${res.status}`;
      throw new PhevnixApiError(res.status, code, message, json ?? text);
    }
    // The CPO wraps some responses as { data, success, ... }; unwrap when present.
    if (json && typeof json === 'object' && 'data' in (json as any) && 'success' in (json as any)) {
      return (json as any).data as T;
    }
    return json as T;
  }

  /** fetch() with a hard timeout so a stalled connection becomes an error instead of hanging forever. */
  private async fetchWithTimeout(url: URL, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (e) {
      if (controller.signal.aborted) {
        throw new PhevnixApiError(0, 'timeout', 'The request timed out — please try again.', null);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Refresh the access token at most once even if many requests 401 at the same time. */
  private ensureRefreshed(): Promise<void> {
    if (!this.refreshing) {
      this.refreshing = this.refresh().then(() => undefined).finally(() => { this.refreshing = undefined; });
    }
    return this.refreshing;
  }

  // ── Driver auth ────────────────────────────────────────────────────────

  async register(input: { email: string; password: string; firstName: string; lastName: string; phone?: string }): Promise<DriverSession> {
    // Registration auto-provisions the driver's charge token and returns its uid — capture it,
    // because the login response (below) does not echo it back.
    const session = await this.request<DriverSession>('POST', '/emsp/v1/auth/driver/register', { body: input });
    this.applySession(session);
    return session;
  }

  async login(email: string, password: string): Promise<DriverSession> {
    const session = await this.request<DriverSession>('POST', '/emsp/v1/auth/driver/login', { body: { email, password } });
    this.applySession(session);
    return session;
  }

  /** Capture tokens from an auth response without clobbering a known tokenUid with undefined. */
  private applySession(session: DriverSession): void {
    if (session.accessToken) this.accessToken = session.accessToken;
    if (session.refreshToken) this.refreshToken = session.refreshToken;
    if (session.driver?.tokenUid) this.tokenUid = session.driver.tokenUid;
    this.emitTokens();
    this.scheduleProactiveRefresh();
  }

  async refresh(): Promise<DriverSession> {
    if (!this.refreshToken) throw new Error('No refresh token — call login() first.');
    const session = await this.request<DriverSession>('POST', '/emsp/v1/auth/driver/refresh', { body: { refreshToken: this.refreshToken } });
    this.accessToken = session.accessToken;
    this.refreshToken = session.refreshToken ?? this.refreshToken;
    this.emitTokens();
    this.scheduleProactiveRefresh();
    return session;
  }

  me(): Promise<unknown> {
    return this.request('GET', '/emsp/v1/auth/driver/me');
  }

  /** Request a password-reset email. Always succeeds (no account enumeration). */
  forgotPassword(email: string): Promise<unknown> {
    return this.request('POST', '/emsp/v1/auth/driver/forgot-password', { body: { email } });
  }

  /** Complete a password reset with the token from the email. */
  resetPassword(token: string, newPassword: string): Promise<unknown> {
    return this.request('POST', '/emsp/v1/auth/driver/reset-password', { body: { token, newPassword } });
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

  getLocationReviews(id: string): Promise<unknown> {
    return this.request('GET', `/emsp/v1/locations/${id}/reviews`);
  }

  submitLocationReview(id: string, input: { rating: number; comment?: string }): Promise<unknown> {
    return this.request('POST', `/emsp/v1/locations/${id}/reviews`, { body: input });
  }

  reportLocationIssue(id: string, input: { category: string; note?: string; chargerId?: string }): Promise<unknown> {
    return this.request('POST', `/emsp/v1/locations/${id}/report`, { body: input });
  }

  // Web push: register/remove this device's push subscription for the signed-in driver.
  subscribePush(subscription: unknown): Promise<unknown> {
    return this.request('POST', '/emsp/v1/push/subscribe', { body: subscription });
  }

  unsubscribePush(endpoint: string): Promise<unknown> {
    return this.request('POST', '/emsp/v1/push/unsubscribe', { body: { endpoint } });
  }

  sendTestPush(): Promise<unknown> {
    return this.request('POST', '/emsp/v1/push/test', {});
  }

  listChargers(query: { page?: number; pageSize?: number } = {}): Promise<unknown> {
    return this.request('GET', '/emsp/v1/chargers', { query });
  }

  getCharger(id: string): Promise<unknown> {
    return this.request('GET', `/emsp/v1/chargers/${id}`);
  }

  /** Charger summary for a scanned QR code / EVSE id, incl. live status + pricing — the scan-to-charge entry point. */
  getChargerInfo(identifier: string): Promise<unknown> {
    return this.request('GET', `/emsp/v1/chargers/${identifier}/info`);
  }

  /** Live status + details of a single connector. */
  getConnectorStatus(connectorId: string): Promise<unknown> {
    return this.request('GET', `/emsp/v1/connectors/${connectorId}/status`);
  }

  listTariffs(query: { activeOnly?: boolean; page?: number; pageSize?: number } = {}): Promise<unknown> {
    return this.request('GET', '/emsp/v1/tariffs', { query });
  }

  getTariff(id: string): Promise<unknown> {
    return this.request('GET', `/emsp/v1/tariffs/${id}`);
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

  getReservation(id: string): Promise<unknown> {
    return this.request('GET', `/emsp/v1/reservations/${id}`);
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

  /** Schedule a charge to auto-start at a future time (departure charging). */
  scheduleCharge(input: { chargerId: string; connectorNumber?: number; idTag?: string; scheduledTime: string }): Promise<unknown> {
    return this.request('POST', '/emsp/v1/charging/schedule', {
      body: { connectorNumber: 1, idTag: this.requireIdTag(input.idTag), ...input },
    });
  }

  listScheduledCharges(): Promise<unknown> {
    return this.request('GET', '/emsp/v1/charging/schedules');
  }

  cancelScheduledCharge(id: string): Promise<unknown> {
    return this.request('DELETE', `/emsp/v1/charging/schedule/${id}`);
  }

  listSessions(query: { status?: string; page?: number; pageSize?: number } = {}): Promise<unknown> {
    return this.request('GET', '/emsp/v1/charging/sessions', { query });
  }

  /** Full session detail incl. itemized cost breakdown — this IS the driver's receipt.
   *  (PDF invoice generation lives behind an operator key — write:transactions — not a driver call.) */
  getSession(id: string): Promise<unknown> {
    return this.request('GET', `/emsp/v1/charging/sessions/${id}`);
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

  /** Reset a charger — Soft (default) recovers the firmware; Hard power-cycles. */
  resetCharger(chargerId: string, type: 'Soft' | 'Hard' = 'Soft'): Promise<unknown> {
    return this.request('POST', `/emsp/v1/remote-control/${chargerId}/reset`, { body: { type } });
  }

  // ── Notifications (driver) ─────────────────────────────────────────────

  getNotificationPreferences(): Promise<unknown> {
    return this.request('GET', '/emsp/v1/notifications/preferences');
  }

  updateNotificationPreferences(prefs: Record<string, boolean | string>): Promise<unknown> {
    return this.request('PUT', '/emsp/v1/notifications/preferences', { body: prefs });
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

  async getPaymentMethods(): Promise<unknown> {
    // The endpoint returns { paymentMode, methods: [...] } (after the {data} unwrap). asArray() only
    // knows .data/.items/bare-array, so expose the card array directly or it renders as "no cards".
    const r = await this.request<unknown>('GET', '/emsp/v1/payments/methods');
    return Array.isArray(r) ? r : ((r as { methods?: unknown })?.methods ?? []);
  }

  /** Begin saving a card — returns a Stripe SetupIntent client_secret + the publishable key. */
  createSetupIntent(): Promise<unknown> {
    return this.request('POST', '/emsp/v1/payments/setup-intent', {});
  }

  setDefaultPaymentMethod(id: string): Promise<unknown> {
    return this.request('POST', `/emsp/v1/payments/methods/${id}/default`);
  }

  removePaymentMethod(id: string): Promise<unknown> {
    return this.request('DELETE', `/emsp/v1/payments/methods/${id}`);
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

/** Hard per-request timeout — long enough for a slow cold start, short enough to never hang a screen. */
const REQUEST_TIMEOUT_MS = 20000;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Read a JWT's `exp` (seconds) as epoch-ms, or null if it can't be parsed. Best-effort, no verification. */
function decodeJwtExpMs(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const payload = JSON.parse(typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
