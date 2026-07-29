/**
 * /robots.txt
 *
 * Permite indexar todo excepto rutas privadas/admin.
 * Incluye referencia al sitemap.xml.
 */

import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/constants'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/cuenta/',
          '/checkout/',
          '/carrito',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  }
}
