import type { SVGProps } from 'react';

type I = SVGProps<SVGSVGElement>;
const base = (p: I) => ({ width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...p });

export const BoltIcon = (p: I) => (
  <svg {...base(p)}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor" stroke="none" /></svg>
);
export const PinIcon = (p: I) => (
  <svg {...base(p)}><path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
);
export const MapIcon = (p: I) => (
  <svg {...base(p)}><path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></svg>
);
export const ClockIcon = (p: I) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const HeartIcon = (p: I) => (
  <svg {...base(p)}><path d="M12 20s-7-4.3-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.7 12 20 12 20Z" /></svg>
);
export const UserIcon = (p: I) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-5 8-5s8 1.7 8 5" /></svg>
);
export const StarIcon = (p: I) => (
  <svg {...base(p)}><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8-4.3-4.1 5.9-.9L12 3Z" /></svg>
);
export const ChevronRight = (p: I) => (
  <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>
);
export const ChevronLeft = (p: I) => (
  <svg {...base(p)}><path d="m15 6-6 6 6 6" /></svg>
);
export const SearchIcon = (p: I) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
);
export const PlugIcon = (p: I) => (
  <svg {...base(p)}><path d="M9 2v5M15 2v5" /><path d="M6 7h12v3a6 6 0 0 1-12 0V7Z" /><path d="M12 16v6" /></svg>
);
export const PowerIcon = (p: I) => (
  <svg {...base(p)}><path d="M12 3v9" /><path d="M7.5 6.5a7 7 0 1 0 9 0" /></svg>
);
export const BellIcon = (p: I) => (
  <svg {...base(p)}><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
);
export const CardIcon = (p: I) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18" /></svg>
);
export const CheckIcon = (p: I) => (
  <svg {...base(p)}><path d="m5 12 5 5 9-11" /></svg>
);
export const LeafIcon = (p: I) => (
  <svg {...base(p)}><path d="M5 19c0-9 7-14 15-14 0 9-6 14-15 14Z" /><path d="M5 19c3-5 7-7 10-8" /></svg>
);
