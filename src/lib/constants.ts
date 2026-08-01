/**
 * Constantes globales del proyecto.
 */

export const SITE = {
  name: 'Munay',
  tagline: 'Tu tienda de ropa nueva y de segunda · Ibarra, Ecuador',
  description:
    'Ropa nueva y de segunda mano, seleccionada con cuidado. ' +
    'Envíos en Ibarra y todo Ecuador.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://munay.example.com',
  locale: 'es-EC',
  currency: 'USD' as const,
  // Para emails transaccionales y contacto
  email: 'contacto@munay.ec',
  // [F3.3 #4] WhatsApp por env var de Vercel (se inlinea en build). Fallback al actual.
  // NOTA: se usa `.trim()` + `||` (no `??`) para que una env var VACÍA o con
  // espacios también caiga al fallback — consistente con whatsappLink.
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() || '+593959756845',
  whatsappLink: `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim()
    ? process.env.NEXT_PUBLIC_WHATSAPP_NUMBER.trim().replace(/\D/g, '')
    : '593959756845'}`,  instagram: 'https://www.instagram.com/munay._ec/',
  tiktok: 'https://www.tiktok.com/@munay._ec?_r=1&_t=ZS-98SJYASLVZw',
  city: 'Ibarra, Imbabura, Ecuador',
} as const

/**
 * [F3.3 #4] Normaliza un número de WhatsApp a dígitos (sin '+' ni espacios)
 * para usarlo en links wa.me/593… (wa.me NO acepta '+').
 */
export function normalizeWhatsAppNumber(raw: string): string {
  return raw.replace(/\D/g, '')
}

/** Equivalencia de puntos: 10 puntos = $1 (100 centavos). */
export const POINTS_RULES = {
  POINTS_PER_DOLLAR: 1, // 1 punto por cada $1 pagado
  POINTS_PER_DISCOUNT_DOLLAR: 10, // 10 puntos = $1 de descuento
  CENTS_PER_POINT_REDEEMED: 10, // 1 punto = 10 centavos de descuento
  MIN_POINTS_TO_REDEEM: 10, // múltiplo mínimo de redención
} as const

/** Configuración en runtime — fallbacks de la tabla `settings` (00023). */
export const SETTINGS_DEFAULTS = {
  // F1.1: umbral de advertencia para cupones de primera_compra (%).
  coupon_first_purchase_warning_threshold: 30,
  // F3.4: toggle de expiración automática de tickets.
  auto_expire_tickets_enabled: true,
} as const

/** Longitudes y límites de validación. */
export const LIMITS = {
  productSlugMin: 3,
  productSlugMax: 120,
  productTitleMin: 3,
  productTitleMax: 200,
  flashCodeMin: 4,
  flashCodeMax: 32,
  maxItemsPerCart: 50,
  // Fix auditoría: cota máxima para shipping_cents ($50 USD = 5000 centavos)
  maxShippingCents: 5000,
} as const

/** Rutas de la aplicación. */
export const ROUTES = {
  home: '/',
  catalogo: '/catalogo',
  producto: (slug: string) => `/p/${slug}`,
  carrito: '/carrito',
  checkout: '/checkout',
  flash: (code: string) => `/flash/${code}`,
  miCuenta: '/cuenta',
} as const
