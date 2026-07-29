/**
 * Constantes globales del proyecto.
 */

export const SITE = {
  name: 'Munay',
  tagline: 'Tienda mística · Ibarra, Ecuador',
  description:
    'Objetos ceremoniales, mineralería y piezas únicas con historia. ' +
    'Envíos en Ibarra y todo Ecuador.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://munay.example.com',
  locale: 'es-EC',
  currency: 'USD' as const,
  // Para emails transaccionales y contacto
  email: 'hola@munay.example.com',
  whatsapp: '+593 99 000 0000',
  city: 'Ibarra, Imbabura, Ecuador',
} as const

/** Equivalencia de puntos: 10 puntos = $1 (100 centavos). */
export const POINTS_RULES = {
  POINTS_PER_DOLLAR: 1, // 1 punto por cada $1 pagado
  POINTS_PER_DISCOUNT_DOLLAR: 10, // 10 puntos = $1 de descuento
  CENTS_PER_POINT_REDEEMED: 10, // 1 punto = 10 centavos de descuento
  MIN_POINTS_TO_REDEEM: 10, // múltiplo mínimo de redención
} as const

/** Configuración de la pasarela de pago activa. */
export const PAYMENT = {
  // Cambiar a 'payphone' | 'paypal' según la decisión de Fase 1.
  provider: (process.env.PAYMENT_PROVIDER ?? 'kushki') as
    | 'kushki'
    | 'payphone'
    | 'paypal',
  sandbox: process.env.PAYMENT_SANDBOX === 'true',
} as const

/** Storage bucket para imágenes de productos. */
export const STORAGE_BUCKETS = {
  productImages: 'product-images',
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
