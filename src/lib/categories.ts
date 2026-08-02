/**
 * [P1] Vocabulario canónico de categorías de producto (tabla `products`).
 *
 * Única fuente de verdad, usada por: admin form, filtros del catálogo,
 * landing (hrefs) y validación server-side. "Todas" y "Marcas" NO son
 * categorías de producto — "Todas" es la ausencia de filtro y "Marcas" es
 * una vista distinta (/marcas).
 */

export const PRODUCT_CATEGORIES = [
  { value: 'chaquetas', label: 'Chaquetas' },
  { value: 'tops', label: 'Tops' },
  { value: 'pantalones', label: 'Pantalones' },
  { value: 'zapatillas', label: 'Zapatillas' },
  { value: 'bolsos', label: 'Bolsos' },
  { value: 'vestidos', label: 'Vestidos' },
  { value: 'accesorios', label: 'Accesorios' },
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]['value']

export const PRODUCT_CATEGORY_VALUES: readonly ProductCategory[] = PRODUCT_CATEGORIES.map(
  (c) => c.value
)

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c) => [c.value, c.label])
)

export function isProductCategory(value: unknown): value is ProductCategory {
  return (
    typeof value === 'string' &&
    (PRODUCT_CATEGORY_VALUES as readonly string[]).includes(value)
  )
}
