/**
 * /sitemap.xml — generado dinámicamente con Neon.
 */

import type { MetadataRoute } from 'next'
import { query, isDbConfigured } from '@/lib/db/neon'
import { SITE } from '@/lib/constants'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1 hora

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE.url
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${baseUrl}/catalogo`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/carrito`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/checkout`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/flash`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${baseUrl}/cuenta/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/admin/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]

  // Fix FLOW3-002/008: query directa Neon (no stub) para productos.
  let productEntries: MetadataRoute.Sitemap = []
  if (isDbConfigured()) {
    try {
      const products = await query<any>(`
        SELECT slug, updated_at, created_at FROM products WHERE active = true ORDER BY created_at DESC
      `)
      productEntries = products.map((p) => ({
        url: `${baseUrl}/p/${p.slug}`,
        lastModified: new Date(p.updated_at ?? p.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }))
    } catch {
      // si falla, solo se envían las estáticas
    }
  }

  return [...staticEntries, ...productEntries]
}
