/**
 * [P1] Queries de marcas (tabla `brands`).
 *
 * Públicas: lista de marcas activas (página /marcas) y resolución por slug
 * (filtro del catálogo). Admin: listar todas + crear + toggle activo.
 *
 * Todas con `isDbConfigured()` guard y try/catch defensivo (patrón del
 * proyecto con `coupons`): si la migración 00024 aún no está aplicada en
 * Neon, devuelven [] en vez de romper la página.
 */

import { query, queryOne, isDbConfigured } from '@/lib/db/neon'
import { slugify } from '@/lib/format'

export interface Brand {
  id: string
  slug: string
  nombre: string
  activo: boolean
  created_at: string
}

/** Marcas activas (página /marcas). */
export async function listActiveBrands(): Promise<Array<{ id: string; slug: string; nombre: string }>> {
  if (!isDbConfigured()) return []
  try {
    const rows = await query<any>(
      `SELECT id, slug, nombre FROM brands
       WHERE activo = true
       ORDER BY nombre ASC`
    )
    return rows.map((r) => ({ id: r.id as string, slug: r.slug as string, nombre: r.nombre as string }))
  } catch (err: any) {
    console.warn('[brands] listActiveBrands error (tabla ausente?):', err?.message)
    return []
  }
}

/** Resuelve una marca por slug (para el banner del filtro del catálogo). */
export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  if (!isDbConfigured()) return null
  try {
    const r = await queryOne<any>(`SELECT id, slug, nombre, activo, created_at FROM brands WHERE slug = $1`, [slug])
    if (!r) return null
    return {
      id: r.id,
      slug: r.slug,
      nombre: r.nombre,
      activo: r.activo,
      created_at: r.created_at,
    }
  } catch (err: any) {
    console.warn('[brands] getBrandBySlug error:', err?.message)
    return null
  }
}

/** Todas las marcas con conteo de productos (admin). */
export async function listAllBrandsForAdmin(): Promise<
  Array<Brand & { products_count: number }>
> {
  if (!isDbConfigured()) return []
  try {
    const rows = await query<any>(
      `SELECT b.id, b.slug, b.nombre, b.activo, b.created_at,
              (SELECT count(*)::int FROM products p WHERE p.marca_id = b.id) AS products_count
       FROM brands b
       ORDER BY b.nombre ASC`
    )
    return rows.map((r) => ({
      id: r.id as string,
      slug: r.slug as string,
      nombre: r.nombre as string,
      activo: r.activo as boolean,
      created_at: r.created_at as string,
      products_count: Number(r.products_count ?? 0),
    }))
  } catch (err: any) {
    console.warn('[brands] listAllBrandsForAdmin error (tabla ausente?):', err?.message)
    return []
  }
}

/** Crea una marca (slug = slugify(nombre)). Lanza 23505 si el nombre/slug ya existe. */
export async function createBrand(nombre: string): Promise<{ id: string; slug: string }> {
  const clean = nombre.trim()
  const slug = slugify(clean)
  const rows = await query<any>(
    `INSERT INTO brands (slug, nombre) VALUES ($1, $2) RETURNING id, slug`,
    [slug, clean]
  )
  const row = rows[0]
  return { id: row.id as string, slug: row.slug as string }
}

/** Toggle activo/inactivo (no borra marcas — no rompe productos asignados).
 *  Devuelve false si el id no existe (para 404 en la API). */
export async function setBrandActive(id: string, activo: boolean): Promise<boolean> {
  const rows = await query<any>(
    `UPDATE brands SET activo = $2 WHERE id = $1 RETURNING id`,
    [id, activo]
  )
  return rows.length > 0
}
