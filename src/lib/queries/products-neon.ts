/**
 * Queries de lectura pública para productos (Neon Postgres).
 *
 * Reemplaza a src/lib/queries/products.ts (Supabase).
 *
 * Como Neon no tiene RLS, los filtros de "active = true" se aplican
 * explícitamente en cada query.
 */

import { query, queryOne, isDbConfigured } from '@/lib/db/neon'
import type { ProductCondition, ProductGrading } from '@/types/database'

// ---- Tipos públicos ----

export interface ProductListItem {
  id: string
  slug: string
  title: string
  price_cents: number
  currency: string
  condition: ProductCondition
  grading: ProductGrading | null
  image_url: string | null
  stock: number
  flash_discount_percent: number | null
  flash_code: string | null
}

export interface ProductDetail extends ProductListItem {
  description: string | null
  images: Array<{ id: string; url: string; sort: number }>
}

// ---- Filtros ----

export interface ProductFilters {
  q?: string
  condition?: ProductCondition | 'all'
  grading?: ProductGrading | 'all'
  minPriceCents?: number
  maxPriceCents?: number
  sort?: 'recent' | 'price_asc' | 'price_desc' | 'title_asc'
  flashCode?: string
}

export const DEFAULT_FILTERS: ProductFilters = {
  sort: 'recent',
  condition: 'all',
  grading: 'all',
}

export function parseFiltersFromSearchParams(
  sp: URLSearchParams | Record<string, string | string[] | undefined>
): ProductFilters {
  const get = (key: string): string | undefined => {
    if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined
    const v = sp[key]
    return Array.isArray(v) ? v[0] : v
  }

  const condition = (get('condition') as ProductFilters['condition']) ?? 'all'
  const grading = (get('grading') as ProductFilters['grading']) ?? 'all'
  const min = get('minPrice')
  const max = get('maxPrice')
  const sort = (get('sort') as ProductFilters['sort']) ?? 'recent'
  const q = get('q')?.trim()
  const flashCode = get('flash')?.trim().toUpperCase()

  return {
    q: q || undefined,
    condition: condition === 'all' ? 'all' : condition === 'new' || condition === 'used' ? condition : 'all',
    grading:
      grading === 'all' || grading === 'excelente' || grading === 'buena' || grading === 'regular'
        ? grading
        : 'all',
    minPriceCents: min && !isNaN(Number(min)) ? Math.max(0, Number(min) * 100) : undefined,
    maxPriceCents: max && !isNaN(Number(max)) ? Math.max(0, Number(max) * 100) : undefined,
    sort: ['recent', 'price_asc', 'price_desc', 'title_asc'].includes(sort as string) ? sort : 'recent',
    flashCode: flashCode || undefined,
  }
}

// ---- Query principal: lista de productos ----

export async function listProducts(filters: ProductFilters = {}): Promise<ProductListItem[]> {
  if (!isDbConfigured()) return []

  const f = { ...DEFAULT_FILTERS, ...filters }

  // Construir WHERE dinámico
  const where: string[] = ['p.active = true']
  const params: any[] = []
  let paramIdx = 1

  if (f.q) {
    where.push(`(p.title ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx})`)
    params.push(`%${f.q}%`)
    paramIdx++
  }
  if (f.condition && f.condition !== 'all') {
    where.push(`p.condition = $${paramIdx}`)
    params.push(f.condition)
    paramIdx++
  }
  if (f.grading && f.grading !== 'all') {
    where.push(`p.grading = $${paramIdx}`)
    params.push(f.grading)
    paramIdx++
  }
  if (f.minPriceCents !== undefined) {
    where.push(`p.price_cents >= $${paramIdx}`)
    params.push(f.minPriceCents)
    paramIdx++
  }
  if (f.maxPriceCents !== undefined) {
    where.push(`p.price_cents <= $${paramIdx}`)
    params.push(f.maxPriceCents)
    paramIdx++
  }

  // ORDER BY
  let orderBy = 'p.created_at DESC'
  switch (f.sort) {
    case 'price_asc':   orderBy = 'p.price_cents ASC'; break
    case 'price_desc':  orderBy = 'p.price_cents DESC'; break
    case 'title_asc':   orderBy = 'p.title ASC'; break
  }

  const sql = `
    SELECT
      p.id, p.slug, p.title, p.price_cents, p.currency, p.condition, p.grading,
      COALESCE(
        (SELECT pi.url FROM product_images pi
         WHERE pi.product_id = p.id ORDER BY pi.sort ASC LIMIT 1),
        NULL
      ) AS image_url,
      COALESCE(i.stock, 0) - COALESCE(i.reserved, 0) AS stock
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy}
  `

  const rows = await query<any>(sql, params)

  const items: ProductListItem[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    price_cents: Number(r.price_cents),
    currency: r.currency,
    condition: r.condition as ProductCondition,
    grading: r.grading as ProductGrading | null,
    image_url: r.image_url,
    stock: Math.max(0, Number(r.stock)),
    flash_discount_percent: null,
    flash_code: null,
  }))

  // Aplicar flash code si está presente
  // FIX v2: solo aplicar descuento a productos en flash_code_products
  if (f.flashCode) {
    const flash = await getValidFlashCode(f.flashCode)
    if (flash) {
      // Obtener los productos asociados a este código
      const associatedIds = await getUnlockedProductIds(flash.code)
      const pct = flash.discount_percent
      const flat = flash.discount_cents

      items.forEach((it) => {
        if (associatedIds.includes(it.id)) {
          it.flash_code = flash.code
          if (flash.type === 'discount') {
            // type=discount: aplicar descuento (porcentual o fijo)
            if (pct != null) {
              it.flash_discount_percent = pct
            } else if (flat != null && flat > 0) {
              const approx = Math.round((flat / Math.max(1, it.price_cents)) * 100)
              it.flash_discount_percent = Math.min(99, Math.max(0, approx))
            }
          } else if (flash.type === 'unlock') {
            // type=unlock: mostrar sin descuento (solo visibilidad)
            it.flash_discount_percent = pct ?? 0
          }
        }
      })
    }
  }

  return items
}

// ---- Detalle por slug ----

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  if (!isDbConfigured()) return null

  const p = await queryOne<any>(`
    SELECT
      p.id, p.slug, p.title, p.description, p.price_cents, p.currency, p.condition, p.grading,
      COALESCE(i.stock, 0) - COALESCE(i.reserved, 0) AS stock
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE p.slug = $1 AND p.active = true
  `, [slug])

  if (!p) return null

  const imgs = await query<any>(`
    SELECT id, url, sort FROM product_images
    WHERE product_id = $1 ORDER BY sort ASC
  `, [p.id])

  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    price_cents: Number(p.price_cents),
    currency: p.currency,
    condition: p.condition as ProductCondition,
    grading: p.grading as ProductGrading | null,
    image_url: imgs.length > 0 ? imgs[0].url : null,
    stock: Math.max(0, Number(p.stock)),
    flash_discount_percent: null,
    flash_code: null,
    images: imgs.map((i: any) => ({ id: i.id, url: i.url, sort: Number(i.sort) })),
  }
}

// ---- Flash codes ----

export interface FlashCodeInfo {
  code: string
  type: 'discount' | 'unlock'
  discount_percent: number | null
  discount_cents: number | null
  ends_at: string
  max_uses: number | null
  uses_count: number
  remaining_uses: number | null
}

export async function getValidFlashCode(code: string): Promise<FlashCodeInfo | null> {
  if (!isDbConfigured()) return null

  const upper = code.trim().toUpperCase()
  const fc = await queryOne<any>(`
    SELECT code, type, discount_percent, discount_cents, starts_at, ends_at, max_uses, uses_count, active
    FROM flash_codes WHERE code = $1
  `, [upper])

  if (!fc || !fc.active) return null
  const now = new Date()
  if (new Date(fc.starts_at) > now || new Date(fc.ends_at) < now) return null
  if (fc.max_uses !== null && Number(fc.uses_count) >= Number(fc.max_uses)) return null

  return {
    code: fc.code,
    type: fc.type,
    discount_percent: fc.discount_percent !== null ? Number(fc.discount_percent) : null,
    discount_cents: fc.discount_cents !== null ? Number(fc.discount_cents) : null,
    ends_at: fc.ends_at,
    max_uses: fc.max_uses !== null ? Number(fc.max_uses) : null,
    uses_count: Number(fc.uses_count),
    remaining_uses: fc.max_uses !== null ? Math.max(0, Number(fc.max_uses) - Number(fc.uses_count)) : null,
  }
}

export async function getUnlockedProductIds(code: string): Promise<string[]> {
  if (!isDbConfigured()) return []
  const rows = await query<any>(`
    SELECT product_id FROM flash_code_products WHERE code = $1
  `, [code.trim().toUpperCase()])
  return rows.map((r) => r.product_id as string)
}

export function looksLikeFlashCode(input: string): boolean {
  const clean = input.trim()
  if (clean.length < 4 || clean.length > 32) return false
  if (/\s/.test(clean)) return false
  if (!/^[a-zA-Z0-9]+$/.test(clean)) return false
  const hasDigit = /\d/.test(clean)
  const hasLetter = /[a-zA-Z]/.test(clean)
  const isAllUpperOrDigits = clean === clean.toUpperCase() && hasLetter
  return hasDigit || isAllUpperOrDigits
}

export function applyFlashDiscount(
  priceCents: number,
  flash: Pick<FlashCodeInfo, 'type' | 'discount_percent' | 'discount_cents'>
): { finalCents: number; discountCents: number; discountPercent: number } | null {
  if (flash.type !== 'discount') return null
  if (flash.discount_percent != null) {
    const d = Math.round(priceCents * (flash.discount_percent / 100))
    return {
      finalCents: Math.max(0, priceCents - d),
      discountCents: d,
      discountPercent: flash.discount_percent,
    }
  }
  if (flash.discount_cents != null && flash.discount_cents > 0) {
    const d = Math.min(priceCents, flash.discount_cents)
    return {
      finalCents: Math.max(0, priceCents - d),
      discountCents: d,
      discountPercent: Math.round((d / Math.max(1, priceCents)) * 100),
    }
  }
  return null
}

// ---- Queries para admin (sin filtro active=true) ----

export async function listAllProductsForAdmin(): Promise<Array<{
  id: string
  slug: string
  title: string
  price_cents: number
  condition: string
  grading: string | null
  active: boolean
  stock: number | null
}>> {
  if (!isDbConfigured()) return []
  const rows = await query<any>(`
    SELECT
      p.id, p.slug, p.title, p.price_cents, p.condition, p.grading, p.active,
      COALESCE(i.stock, 0) AS stock
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    ORDER BY p.created_at DESC
  `)
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    price_cents: Number(r.price_cents),
    condition: r.condition,
    grading: r.grading,
    active: r.active,
    stock: r.stock !== null ? Number(r.stock) : null,
  }))
}

export async function getProductByIdForAdmin(id: string) {
  if (!isDbConfigured()) return null
  return await queryOne<any>(`
    SELECT
      p.id, p.slug, p.title, p.description, p.price_cents, p.currency, p.condition, p.grading, p.active,
      COALESCE(i.stock, 0) AS stock
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE p.id = $1
  `, [id])
}

export async function getProductBySlugAdmin(slug: string) {
  if (!isDbConfigured()) return null
  return await queryOne<any>(`
    SELECT id, slug, title, description, price_cents, currency, condition, grading, active
    FROM products WHERE slug = $1
  `, [slug])
}
