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
  flashCampaign?: boolean
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
    flashCampaign: get('flashCampaign') === 'true',
  }
}

// ---- Mapping de condición de listing a grading de producto ----
const LISTING_CONDITION_TO_GRADING: Record<string, ProductGrading | null> = {
  'new': null,       // nuevo → sin grading
  'like_new': 'excelente',
  'good': 'buena',
  'fair': 'regular',
}

/**
 * [P0a] Parsea imágenes de listings sin lanzar: un JSON malformado en
 * `user_listings.images` NO debe romper todo el catálogo (crash real
 * detectado en auditoría — causaba el server error genérico de Next).
 */
function safeParseImages(raw: unknown): string[] {
  try {
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === 'string')
        : []
    }
    return Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === 'string')
      : []
  } catch {
    return []
  }
}

// ---- Query principal: lista de productos (incluye P2P listings) ----

/**
 * [P0a] `listProducts` SIN try/catch interno a propósito: la página /catalogo
 * es el boundary de error (su try/catch setea `searchError` y muestra el error
 * state). Si aquí tragáramos los errores devolviendo [], la página mostraría
 * el empty state ("No encontramos resultados") ante una falla real de Neon en
 * vez del error state ("No pudimos realizar la búsqueda") — revisores Ronda 1.
 * Los sub-queries internos (getValidFlashCode/getUnlockedProducts/
 * getFlashSpecialPrice) SÍ conservan null-safety porque otros callers
 * (createOrder, redirect block) necesitan degradar sin lanzar.
 *
 * [Fix Ronda 2] Sin wrapper separado: una sola función (el wrapper ya no
 * añadía nada tras quitar el try/catch).
 */
export async function listProducts(filters: ProductFilters = {}): Promise<ProductListItem[]> {
  if (!isDbConfigured()) return []

  const f = { ...DEFAULT_FILTERS, ...filters }

  // [F2.2] Resolver el flash code ANTES de construir las queries: si hay uno
  // válido, FILTRAMOS por sus productos (WHERE p.id IN ...), excluimos P2P y
  // revelamos las piezas ocultas (active=false) asociadas al código.
  let flashInfo: FlashCodeInfo | null = null
  if (f.flashCode) {
    flashInfo = await getValidFlashCode(f.flashCode)
  }

  // P2P listings solo cuando NO hay flash activo y el filtro no es 'new'
  const includeP2P = f.condition !== 'new' && !flashInfo

  let items: ProductListItem[] = []
  const paramIdxRef = { current: 1 }

  // ── 1. Productos del admin (tabla products) — siempre ──
  {
    // Con flash activo se revelan también las piezas ocultas (active=false)
    // asociadas al código; sin flash, solo las activas.
    const where: string[] = flashInfo ? [] : ['p.active = true']
    const params: any[] = []

    // [F2.2] Cuando hay flash activo, se ignora `q` (el código ya define el
    // conjunto de productos; evita filtrar por "title ILIKE %CODIGO%").
    if (f.q && !flashInfo) {
      where.push(`(p.title ILIKE $${paramIdxRef.current} OR p.description ILIKE $${paramIdxRef.current})`)
      params.push(`%${f.q}%`)
      paramIdxRef.current++
    }
    if (f.condition && f.condition !== 'all') {
      where.push(`p.condition = $${paramIdxRef.current}`)
      params.push(f.condition)
      paramIdxRef.current++
    }
    if (f.grading && f.grading !== 'all') {
      where.push(`p.grading = $${paramIdxRef.current}`)
      params.push(f.grading)
      paramIdxRef.current++
    }
    if (f.minPriceCents !== undefined) {
      where.push(`p.price_cents >= $${paramIdxRef.current}`)
      params.push(f.minPriceCents)
      paramIdxRef.current++
    }
    if (f.maxPriceCents !== undefined) {
      where.push(`p.price_cents <= $${paramIdxRef.current}`)
      params.push(f.maxPriceCents)
      paramIdxRef.current++
    }
    if (f.flashCampaign) {
      where.push(`p.id IN (
        SELECT fcp.product_id FROM flash_campaign_products fcp
        JOIN flash_campaigns fc ON fc.id = fcp.campaign_id
        WHERE fc.active = true AND fc.ends_at > now() AND fc.starts_at <= now()
      )`)
    }
    // [F2.2] Filtrado REAL: solo los productos desbloqueados por el código.
    if (flashInfo) {
      where.push(`p.id IN (SELECT product_id FROM flash_code_products WHERE code = $${paramIdxRef.current})`)
      params.push(flashInfo.code)
      paramIdxRef.current++
    }

    let orderBy = 'p.created_at DESC'
    switch (f.sort) {
      case 'price_asc':   orderBy = 'p.price_cents ASC'; break
      case 'price_desc':  orderBy = 'p.price_cents DESC'; break
      case 'title_asc':   orderBy = 'p.title ASC'; break
    }

    const productRows = await query<any>(`
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
    `, params)

    items = productRows.map((r: any) => ({
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
  }

  // ── 2. P2P listings publicados (user_listings) — solo cuando no es filtro 'new' ──
  // [FIX BÚSQUEDA] Contador LOCAL e independiente del bloque 1 (products).
  // ANTES se reutilizaba `paramIdxRef` (compartido con el bloque 1): con `q`
  // activo, el bloque 1 usaba $1 y dejaba el contador en 2; este bloque
  // generaba $2 pero listingParams arrancaba con 1 elemento → Postgres 42P18
  // → "No pudimos realizar la búsqueda". Cada query() es independiente y
  // recibe su propio array de params, así que DEBE indexar desde $1.
  if (includeP2P) {
    const listingParamIdx = { current: 1 }
    const listingWhere: string[] = ["ul.status IN ('verified', 'published')", 'ul.active = true']
    const listingParams: any[] = []

    if (f.q) {
      listingWhere.push(`(ul.title ILIKE $${listingParamIdx.current} OR ul.description ILIKE $${listingParamIdx.current})`)
      listingParams.push(`%${f.q}%`)
      listingParamIdx.current++
    }
    if (f.minPriceCents !== undefined) {
      listingWhere.push(`ul.price_cents >= $${listingParamIdx.current}`)
      listingParams.push(f.minPriceCents)
      listingParamIdx.current++
    }
    if (f.maxPriceCents !== undefined) {
      listingWhere.push(`ul.price_cents <= $${listingParamIdx.current}`)
      listingParams.push(f.maxPriceCents)
      listingParamIdx.current++
    }

    const listingRows = await query<any>(`
      SELECT
        ul.id, ul.title, ul.price_cents, ul.condition, ul.images, ul.size, ul.brand
      FROM user_listings ul
      WHERE ${listingWhere.join(' AND ')}
      ORDER BY ul.created_at DESC
    `, listingParams)

    const listingItems: ProductListItem[] = listingRows.map((r: any) => {
      // [P0a] safeParseImages: un JSON malformado no rompe la búsqueda.
      const images = safeParseImages(r.images)
      return {
        id: `p2p_${r.id}`,  // prefijo para evitar colisión con IDs de productos
        slug: `listing-${r.id.slice(0, 8)}`,
        title: r.title,
        price_cents: Number(r.price_cents),
        currency: 'USD',
        condition: 'used' as ProductCondition,
        grading: LISTING_CONDITION_TO_GRADING[r.condition] ?? 'buena',
        image_url: images.length > 0 ? images[0] : null,
        stock: 1,  // cada listing es una unidad única
        flash_discount_percent: null,
        flash_code: null,
      }
    })

    items = [...items, ...listingItems]
  }

  // Aplicar flash code si está presente (solo unlock — F0/BLOQUE B)
  // El descuento de un código flash proviene de precio_especial_cents
  // por producto (NULL → sin descuento, solo badge 'Desbloqueado').
  // [F2.2] Con flash activo los items YA son solo los desbloqueados
  // (filtrado en la query); aquí solo se marca código y % por pieza.
  if (flashInfo) {
    const unlocked = await getUnlockedProducts(flashInfo.code)
    const specialByProduct = new Map(unlocked.map((u) => [u.product_id, u.precio_especial_cents]))

    items.forEach((it) => {
      const special = specialByProduct.get(it.id)
      if (specialByProduct.has(it.id)) {
        it.flash_code = flashInfo!.code
        if (special != null && special > 0 && special < it.price_cents) {
          const approx = Math.round((1 - special / Math.max(1, it.price_cents)) * 100)
          it.flash_discount_percent = Math.min(99, Math.max(0, approx))
        } else {
          it.flash_discount_percent = null
        }
      }
    })
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

// ---- Flash codes (solo unlock — F0/BLOQUE B) ----

export interface FlashCodeInfo {
  code: string
  type: 'unlock'
  starts_at: string
  ends_at: string
  max_uses: number | null
  uses_count: number
  remaining_uses: number | null
}

export async function getValidFlashCode(code: string): Promise<FlashCodeInfo | null> {
  if (!isDbConfigured()) return null
  // [P0a] try/catch: un error transitorio de Neon NO rompe la búsqueda
  // (devuelve null → el texto se trata como búsqueda normal).
  try {
    return await getValidFlashCodeInternal(code)
  } catch (err: any) {
    console.warn('[products-neon] getValidFlashCode error:', err?.message)
    return null
  }
}

async function getValidFlashCodeInternal(code: string): Promise<FlashCodeInfo | null> {
  const upper = code.trim().toUpperCase()
  const fc = await queryOne<any>(`
    SELECT code, starts_at, ends_at, max_uses, uses_count, active
    FROM flash_codes WHERE code = $1
  `, [upper])

  if (!fc || !fc.active) return null
  const now = new Date()
  if (new Date(fc.starts_at) > now || new Date(fc.ends_at) < now) return null
  if (fc.max_uses !== null && Number(fc.uses_count) >= Number(fc.max_uses)) return null

  return {
    code: fc.code,
    type: 'unlock',
    starts_at: fc.starts_at,
    ends_at: fc.ends_at,
    max_uses: fc.max_uses !== null ? Number(fc.max_uses) : null,
    uses_count: Number(fc.uses_count),
    remaining_uses: fc.max_uses !== null ? Math.max(0, Number(fc.max_uses) - Number(fc.uses_count)) : null,
  }
}

export interface UnlockedProduct {
  product_id: string
  precio_especial_cents: number | null
}

export async function getUnlockedProducts(code: string): Promise<UnlockedProduct[]> {
  if (!isDbConfigured()) return []
  try {
    const rows = await query<any>(`
      SELECT product_id, precio_especial_cents FROM flash_code_products WHERE code = $1
    `, [code.trim().toUpperCase()])
    return rows.map((r) => ({
      product_id: r.product_id as string,
      precio_especial_cents: r.precio_especial_cents != null ? Number(r.precio_especial_cents) : null,
    }))
  } catch (err: any) {
    console.warn('[products-neon] getUnlockedProducts error:', err?.message)
    return []
  }
}

/** Precio especial de un producto para un código flash (NULL → usar price_cents). */
export async function getFlashSpecialPrice(code: string, productId: string): Promise<number | null> {
  if (!isDbConfigured()) return null
  try {
    const row = await queryOne<any>(`
      SELECT precio_especial_cents FROM flash_code_products
      WHERE code = $1 AND product_id = $2 LIMIT 1
    `, [code.trim().toUpperCase(), productId])
    return row?.precio_especial_cents != null ? Number(row.precio_especial_cents) : null
  } catch (err: any) {
    console.warn('[products-neon] getFlashSpecialPrice error:', err?.message)
    return null
  }
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

/**
 * [Eliminado en F0/BLOQUE B] applyFlashDiscount ya no existe:
 * los códigos flash son SOLO 'unlock' y su descuento proviene de
 * flash_code_products.precio_especial_cents. Los descuentos por
 * porcentaje generales viven en la tabla coupons.
 */

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
      COALESCE(i.stock, 0) - COALESCE(i.reserved, 0) AS stock
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
