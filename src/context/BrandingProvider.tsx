import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_BRAND, applyBrandTheme, loadBrandConfig, type BrandConfig } from '../lib/branding.ts';

// Holds the resolved brand (name, tagline, logo, colors) and applies it to the document on load.
// Screens read it via useBranding() to render the brand name/logo; the accent color is applied as a
// CSS var so existing `*-volt` utility classes recolor automatically — no per-component change.
const BrandingContext = createContext<BrandConfig>(DEFAULT_BRAND);

export function useBranding(): BrandConfig {
  return useContext(BrandingContext);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);

  useEffect(() => {
    let alive = true;
    loadBrandConfig().then((cfg) => {
      if (!alive) return;
      setBrand(cfg);
      applyBrandTheme(cfg);
    });
    return () => {
      alive = false;
    };
  }, []);

  return <BrandingContext.Provider value={brand}>{children}</BrandingContext.Provider>;
}
