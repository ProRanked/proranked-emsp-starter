import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'es';

/**
 * Lightweight i18n keyed by the English source string — wrap UI text in t('…').
 * Spanish for the Puerto Rico / LatAm market; unknown strings fall back to English.
 */
const ES: Record<string, string> = {
  // Nav
  Charge: 'Cargar',
  Activity: 'Actividad',
  Reserved: 'Reservas',
  Saved: 'Guardados',
  Account: 'Cuenta',
  // Auth
  'Welcome back': 'Bienvenido de nuevo',
  'Sign in to find and start charging.': 'Inicia sesión para encontrar y cargar.',
  Email: 'Correo electrónico',
  Password: 'Contraseña',
  'Sign in': 'Iniciar sesión',
  'Create one': 'Crear cuenta',
  'New to Voltway?': '¿Nuevo en Voltway?',
  // Home
  'Good to see you,': 'Qué bueno verte,',
  'Search a city or address…': 'Busca una ciudad o dirección…',
  '← Back to San Juan': '← Volver a San Juan',
  'Available now': 'Disponible ahora',
  'Fast ⚡': 'Rápido ⚡',
  'Chargers near you': 'Cargadores cerca de ti',
  'Charging in progress': 'Cargando ahora',
  'tap to view & stop': 'toca para ver y detener',
  'No charging sites yet': 'Aún no hay estaciones',
  // Common
  available: 'disponibles',
  'In use': 'En uso',
  'Get directions': 'Cómo llegar',
  'Get started': 'Empezar',
  'Try again': 'Reintentar',
  'Stop charging': 'Detener carga',
  'Start charging': 'Iniciar carga',
  // Account
  Notifications: 'Notificaciones',
  Payment: 'Pago',
  'My vehicles': 'Mis vehículos',
  'My reservations': 'Mis reservas',
  'Sign out': 'Cerrar sesión',
  'Your charge tag (RFID)': 'Tu etiqueta de carga (RFID)',
  sessions: 'sesiones',
  spent: 'gastado',
  Language: 'Idioma',
  // Activity / receipt
  'Your charging history & receipts': 'Tu historial de carga y recibos',
  'No charges yet': 'Aún no hay cargas',
  Receipt: 'Recibo',
  'Share receipt': 'Compartir recibo',
  Pricing: 'Precios',
  Energy: 'Energía',
  'Already have an account?': '¿Ya tienes cuenta?',
  'Create your account': 'Crea tu cuenta',
  'Start charging in under a minute.': 'Empieza a cargar en menos de un minuto.',
  'Create account': 'Crear cuenta',
  'Charge tag': 'Etiqueta de carga',
  kWh: 'kWh',
};

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (s: string) => string;
}

const Ctx = createContext<I18n>({ lang: 'en', setLang: () => {}, t: (s) => s });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem('voltway.lang') as Lang | null;
      if (saved) return saved;
      return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
    } catch {
      return 'en';
    }
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('voltway.lang', l); } catch { /* ignore */ }
    try { document.documentElement.lang = l; } catch { /* ignore */ }
  };
  const t = (s: string) => (lang === 'es' ? ES[s] ?? s : s);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);
