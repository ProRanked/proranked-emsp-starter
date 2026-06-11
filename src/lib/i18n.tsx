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
  'Push notifications': 'Notificaciones push',
  'Charging started, stopped, and reminders': 'Carga iniciada, detenida y recordatorios',
  'Receipts and account updates': 'Recibos y novedades de la cuenta',
  SMS: 'SMS',
  'Text alerts for key events': 'Alertas de texto para eventos clave',
  'Notifications aren’t enabled by your provider.': 'Tu proveedor no ha habilitado las notificaciones.',
  'Managed by Voltway': 'Gestionado por Voltway',
  'Add a card to charge instantly. Receipts arrive after each session.': 'Agrega una tarjeta para cargar al instante. Los recibos llegan tras cada sesión.',
  'Add payment method': 'Agregar método de pago',
  'Billed directly by your provider': 'Facturado directamente por tu proveedor',
  'This network handles payment on its own — nothing to set up here.': 'Esta red gestiona el pago por su cuenta — no hay nada que configurar aquí.',
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
  // Live session
  Charging: 'Cargando',
  'Charging controls': 'Controles de carga',
  'Charging started': 'Carga iniciada',
  'Your session is now live': 'Tu sesión está activa',
  'Charging complete': 'Carga completada',
  'Tap for receipt': 'Toca para ver el recibo',
  'kWh delivered': 'kWh entregados',
  'No active session. Start one from a charger — your live energy, power, and cost will appear here.':
    'No hay sesión activa. Inicia una desde un cargador: verás tu energía, potencia y costo en vivo aquí.',
  'kW now': 'kW ahora',
  Battery: 'Batería',
  'Nearly full — charging may slow to protect the battery.':
    'Casi llena — la carga puede ralentizarse para proteger la batería.',
  'Reported live by the charger.': 'Reportado en vivo por el cargador.',
  'Charge limit': 'Límite de carga',
  'Auto-stops at': 'Se detiene automáticamente al',
  'No limit': 'Sin límite',
  'Charge limit reached — stopping.': 'Límite de carga alcanzado — deteniendo.',
  'Battery at end': 'Batería al final',
  'Add a card': 'Agregar tarjeta',
  'Add a payment method': 'Agrega un método de pago',
  'Save card': 'Guardar tarjeta',
  'Make default': 'Predeterminar',
  Default: 'Predeterminada',
  Expires: 'Vence',
  'Could not save the card.': 'No se pudo guardar la tarjeta.',
  'Card setup isn’t available right now.': 'La configuración de tarjeta no está disponible ahora.',
  minutes: 'minutos',
  min: 'min',
  cost: 'costo',
  'Charging speed': 'Velocidad de carga',
  'Charging power': 'Potencia de carga',
  'Charge goal': 'Meta de carga',
  'Goal reached': 'Meta alcanzada',
  'min left': 'min restantes',
  Goal: 'Meta',
  Off: 'Sin meta',
  'Gathering live power…': 'Recopilando potencia en vivo…',
  peak: 'máx.',
  avg: 'prom.',
  'Eco · 6 A': 'Eco · 6 A',
  'Max · 32 A': 'Máx · 32 A',
  // Charger detail
  Charger: 'Cargador',
  'Max power': 'Potencia máx.',
  'Energy rate': 'Tarifa de energía',
  Free: 'Gratis',
  'Choose a connector': 'Elige un conector',
  Online: 'En línea',
  'Last seen': 'Visto por última vez',
  Connector: 'Conector',
  'This charger is': 'Este cargador es',
  'Free to use': 'Gratis',
  Time: 'Tiempo',
  'Session fee': 'Cargo por sesión',
  'Idle fee': 'Cargo por inactividad',
  "You're charging here now": 'Estás cargando aquí ahora',
  'View live session': 'Ver sesión en vivo',
  'Reserve for 15 min': 'Reservar por 15 min',
  'Billed to your Voltway account when the session ends.':
    'Se cobrará a tu cuenta Voltway al terminar la sesión.',
  'Connector reserved for 15 minutes. Head over and plug in.':
    'Conector reservado por 15 minutos. Ve y conéctate.',
  'This connector is in use right now. Try another connector or come back shortly.':
    'Este conector está en uso ahora. Prueba otro conector o vuelve en un momento.',
  'This charger is offline right now. Try another connector or site.':
    'Este cargador está fuera de línea ahora. Prueba otro conector o sitio.',
  'This connector is reserved right now. Try another connector.':
    'Este conector está reservado ahora. Prueba otro conector.',
  'Add a payment method to start charging.':
    'Agrega un método de pago para comenzar a cargar.',
  // Location detail
  'Charging site': 'Estación de carga',
  'Chargers at this site': 'Cargadores en este sitio',
  Reviews: 'Reseñas',
  reviews: 'reseñas',
  review: 'reseña',
  'Show all': 'Ver todos',
  chargers: 'cargadores',
  'No reviews yet — be the first to rate this site.': 'Aún no hay reseñas — sé el primero en calificar este sitio.',
  'Write a review': 'Escribir una reseña',
  'Edit your review': 'Editar tu reseña',
  'Share details (optional)': 'Comparte detalles (opcional)',
  Submit: 'Enviar',
  You: 'Tú',
  'Report an issue': 'Reportar un problema',
  'Broken connector': 'Conector dañado',
  'Blocked spot': 'Espacio bloqueado',
  'Payment issue': 'Problema de pago',
  Offline: 'Fuera de línea',
  Other: 'Otro',
  'What’s wrong? (optional)': '¿Qué pasa? (opcional)',
  'Send report': 'Enviar reporte',
  'Thanks — we’ve let the operator know.': 'Gracias — avisamos al operador.',
  'Open 24/7': 'Abierto 24/7',
  Today: 'Hoy',
  'Closed today': 'Cerrado hoy',
  Parking: 'Estacionamiento',
  Restrooms: 'Baños',
  WiFi: 'WiFi',
  Call: 'Llamar',
  'No chargers listed': 'No hay cargadores listados',
  'Saved places aren’t enabled by your provider.': 'Tu proveedor no ha habilitado los lugares guardados.',
  'Could not save.': 'No se pudo guardar.',
  of: 'de',
  // Activity / receipt
  'Start a session and it’ll appear here with a full receipt.':
    'Inicia una sesión y aparecerá aquí con un recibo completo.',
  'kWh total': 'kWh total',
  'Charging session': 'Sesión de carga',
  Insights: 'Análisis',
  'Your charging impact': 'Tu impacto de carga',
  'Charging insights': 'Análisis de carga',
  'CO₂ avoided, trends & top stations': 'CO₂ evitado, tendencias y estaciones top',
  'No impact yet': 'Aún no hay impacto',
  'Charge a few times and your impact and trends will appear here.':
    'Carga varias veces y tu impacto y tendencias aparecerán aquí.',
  'estimated CO₂ avoided vs. gasoline': 'CO₂ evitado estimado vs. gasolina',
  'Energy by month': 'Energía por mes',
  'avg / session': 'prom / sesión',
  'avg / kWh': 'prom / kWh',
  'Most-used stations': 'Estaciones más usadas',
  'CO₂ figure is an estimate for illustration, net of average grid emissions.':
    'La cifra de CO₂ es una estimación ilustrativa, neta de las emisiones medias de la red.',
  'Plan a trip': 'Planear un viaje',
  'Charging stops along your route': 'Paradas de carga en tu ruta',
  'chargers along your route': 'cargadores en tu ruta',
  From: 'Desde',
  To: 'Hasta',
  'Current location': 'Ubicación actual',
  'Destination city or address': 'Ciudad o dirección de destino',
  'Plan trip': 'Planear viaje',
  'Set a starting point.': 'Define un punto de partida.',
  'Couldn’t find that destination.': 'No se encontró ese destino.',
  'No driving route found.': 'No se encontró una ruta.',
  'Couldn’t plan that trip. Try again.': 'No se pudo planear el viaje. Inténtalo de nuevo.',
  'Couldn’t load payment options.': 'No se pudieron cargar las opciones de pago.',
  distance: 'distancia',
  'drive time': 'tiempo de viaje',
  'No charging stops within reach of this route.': 'No hay paradas de carga cerca de esta ruta.',
  'Stops on your route': 'Paradas en tu ruta',
  'on route': 'en ruta',
  'This charger is offline right now — it can’t start a session. Try another charger or site.':
    'Este cargador está desconectado ahora — no puede iniciar una sesión. Prueba otro cargador o sitio.',
  'Schedule for later': 'Programar para después',
  'Schedule charge': 'Programar carga',
  'Start time': 'Hora de inicio',
  'Scheduled to start': 'Programado para iniciar',
  'Scheduled charges': 'Cargas programadas',
  Starts: 'Inicia',
  'Sort by': 'Ordenar por',
  Nearest: 'Más cercano',
  'Most available': 'Más disponibles',
  Fastest: 'Más rápido',
  'Top rated': 'Mejor valorado',
  site: 'sitio',
  sites: 'sitios',
  Started: 'Iniciado',
  Ended: 'Finalizado',
  'Authorized via': 'Autorizado vía',
  Paid: 'Pagado',
  'Card authorized': 'Tarjeta autorizada',
  Refunded: 'Reembolsado',
  'No charge': 'Sin cargo',
  'Idle time': 'Tiempo inactivo',
  Charges: 'Cargos',
  Taxes: 'Impuestos',
  Total: 'Total',
  'peak kW': 'kW máx.',
  'Receipt copied to clipboard.': 'Recibo copiado al portapapeles.',
  // Favorites
  'Saved places': 'Lugares guardados',
  'Your go-to charging spots': 'Tus sitios de carga favoritos',
  'Saved places aren’t enabled yet': 'Los lugares guardados aún no están habilitados',
  'Your charging provider hasn’t turned on saved places. It can be enabled any time — no app update needed.':
    'Tu proveedor de carga no ha activado los lugares guardados. Se puede habilitar en cualquier momento, sin actualizar la app.',
  'No saved places': 'No hay lugares guardados',
  'Tap the heart on any site to save it here.': 'Toca el corazón en cualquier sitio para guardarlo aquí.',
  'Saved place': 'Lugar guardado',
  // Reservations
  Reservations: 'Reservas',
  'Connectors you’ve held for later': 'Conectores que reservaste para más tarde',
  'Reservations aren’t enabled by your provider.': 'Tu proveedor no ha habilitado las reservas.',
  'No reservations': 'No hay reservas',
  'Reserve a connector from a charger and it’ll show up here.':
    'Reserva un conector desde un cargador y aparecerá aquí.',
  'Hold expires': 'La reserva vence',
  Tag: 'Etiqueta',
  'Cancel reservation': 'Cancelar reserva',
  // Vehicles
  'Cars linked to your account': 'Autos vinculados a tu cuenta',
  'Vehicles aren’t enabled yet': 'Los vehículos aún no están habilitados',
  'Your provider hasn’t turned on vehicle linking (e.g. Smartcar). It can be enabled any time — no app update needed.':
    'Tu proveedor no ha activado la vinculación de vehículos (p. ej. Smartcar). Se puede habilitar en cualquier momento, sin actualizar la app.',
  'No vehicles yet': 'Aún no hay vehículos',
  'Add your EV to personalize charging.': 'Agrega tu EV para personalizar la carga.',
  Vehicle: 'Vehículo',
  Remove: 'Eliminar',
  Make: 'Marca',
  Model: 'Modelo',
  Year: 'Año',
  'Save vehicle': 'Guardar vehículo',
  Cancel: 'Cancelar',
  '+ Add a vehicle': '+ Agregar un vehículo',
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
