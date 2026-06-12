// Runtime brand configuration for the eMSP driver app.
//
// By default the app wears the neutral "Voltway" reference brand. A deployment can re-skin it
// WITHOUT a rebuild via white-labeling:
//   • ?brandId={networkUuid} in the URL  → fetch THAT network's live branding (phase-1 white-label).
//     The brand is sticky: once seen it is remembered (localStorage) so in-app navigation that drops
//     the query string keeps the brand. (Phase 2 will resolve the network from a subdomain instead.)
//   • VITE_BRAND_* build-time env         → a fixed brand baked for a single-tenant build.
//
// In a BFF deployment (VITE_BFF_MODE), branding is resolved server-side at /bff/config (the BFF
// dogfoods the public /emsp/v1/networks/{id}/branding endpoint). In the standalone OSS build that
// endpoint is fetched directly. Either way this module stays brand-agnostic.

export type BrandConfig = {
  brand: string;
  tagline: string;
  logoUrl: string; // '' = use the built-in bolt mark
  primaryColor: string; // hex; drives the --color-volt accent
  secondaryColor: string; // hex; drives the --color-volt-dim shade
};

export const DEFAULT_BRAND: BrandConfig = {
  brand: 'Voltway',
  tagline: 'Charge anywhere. Pay your way.',
  logoUrl: '',
  primaryColor: '#2ee6a6',
  secondaryColor: '#1d8c66',
};

const env = import.meta.env;
const BFF_MODE = env.VITE_BFF_MODE === 'true';
const BRAND_ID_KEY = 'phevnix.brandId';
const HEX = /^#[0-9a-fA-F]{6}$/;

function fromEnv(): BrandConfig {
  return {
    brand: (env.VITE_BRAND_NAME as string) || DEFAULT_BRAND.brand,
    tagline: (env.VITE_BRAND_TAGLINE as string) || DEFAULT_BRAND.tagline,
    logoUrl: (env.VITE_BRAND_LOGO as string) || DEFAULT_BRAND.logoUrl,
    primaryColor: (env.VITE_BRAND_PRIMARY as string) || DEFAULT_BRAND.primaryColor,
    secondaryColor: (env.VITE_BRAND_SECONDARY as string) || DEFAULT_BRAND.secondaryColor,
  };
}

// The brand id (a network UUID) from the URL query, remembered across navigation.
export function resolveBrandId(): string {
  try {
    const q = new URLSearchParams(window.location.search).get('brandId');
    if (q) {
      localStorage.setItem(BRAND_ID_KEY, q);
      return q;
    }
    return localStorage.getItem(BRAND_ID_KEY) || '';
  } catch {
    return '';
  }
}

// Darken a #rrggbb hex toward black by `amount` (0..1) — derives the dim/hover accent shade when a
// brand specifies only a primary color.
function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount));
  return '#' + [ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Apply the brand to the live document: the accent CSS vars (every `*-volt` Tailwind utility reads
// --color-volt), the page title, and the favicon.
export function applyBrandTheme(cfg: BrandConfig): void {
  const root = document.documentElement;
  if (HEX.test(cfg.primaryColor)) {
    root.style.setProperty('--color-volt', cfg.primaryColor);
    root.style.setProperty(
      '--color-volt-dim',
      HEX.test(cfg.secondaryColor) ? cfg.secondaryColor : darken(cfg.primaryColor, 0.4),
    );
  }
  if (cfg.brand) document.title = cfg.brand;
  if (cfg.logoUrl) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = cfg.logoUrl;
  }
}

function merge(base: BrandConfig, c: Partial<BrandConfig> | null | undefined): BrandConfig {
  if (!c) return base;
  return {
    brand: c.brand || base.brand,
    tagline: c.tagline || base.tagline,
    logoUrl: c.logoUrl || base.logoUrl,
    primaryColor: c.primaryColor || base.primaryColor,
    secondaryColor: c.secondaryColor || base.secondaryColor,
  };
}

// BFF deployments resolve branding (incl. any deployment default) at /bff/config server-side.
async function loadFromBff(brandId: string, base: BrandConfig): Promise<BrandConfig> {
  const q = brandId ? `?brandId=${encodeURIComponent(brandId)}` : '';
  const r = await fetch(`/bff/config${q}`, { credentials: 'include' });
  if (!r.ok) return base;
  return merge(base, (await r.json()) as Partial<BrandConfig>);
}

// OSS / standalone build: hit the public anonymous branding endpoint directly. Shape: { data: {...} }.
async function loadFromPublicApi(brandId: string, base: BrandConfig): Promise<BrandConfig> {
  const apiBase = ((env.VITE_EMSP_API_BASE as string) || '').replace(/\/$/, '');
  const r = await fetch(`${apiBase}/emsp/v1/networks/${encodeURIComponent(brandId)}/branding`);
  if (!r.ok) return base;
  const body = (await r.json()) as { data?: Record<string, string | null> };
  const d = body.data;
  if (!d) return base;
  return merge(base, {
    brand: d.name ?? undefined,
    logoUrl: d.logoUrl ?? undefined,
    primaryColor: d.primaryColor ?? undefined,
    secondaryColor: d.secondaryColor ?? undefined,
  });
}

export async function loadBrandConfig(): Promise<BrandConfig> {
  const base = fromEnv();
  const brandId = resolveBrandId();
  try {
    if (BFF_MODE) return await loadFromBff(brandId, base);
    if (brandId) return await loadFromPublicApi(brandId, base);
  } catch {
    /* network/parse failure — fall back to the env/default brand so the app still loads */
  }
  return base;
}
