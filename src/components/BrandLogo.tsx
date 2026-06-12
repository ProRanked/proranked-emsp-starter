import { useBranding } from '../context/BrandingProvider.tsx';
import { BoltIcon } from './icons.tsx';

// The brand mark: the operator's logo when their network sets one, else the built-in bolt glyph on
// the accent color. Drops into the same rounded-square slot the hard-coded mark used to occupy.
export function BrandLogo({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const { brand, logoUrl } = useBranding();
  const box = size === 'lg' ? 'h-12 w-12' : 'h-11 w-11';
  const icon = size === 'lg' ? 'h-7 w-7' : 'h-6 w-6';

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={brand}
        className={`${box} shrink-0 rounded-2xl bg-white object-contain p-1 ${className}`}
      />
    );
  }
  return (
    <div className={`flex ${box} shrink-0 items-center justify-center rounded-2xl bg-volt text-ink ${className}`}>
      <BoltIcon className={icon} />
    </div>
  );
}
