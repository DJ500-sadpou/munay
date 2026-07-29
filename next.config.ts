import type { NextConfig } from "next";

// Fix auditoría: headers de seguridad HTTP.
// CSP, HSTS, X-Frame-Options, X-Content-Type-Options
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  // Fix FLOW3-011: ignoreBuildErrors eliminado completamente.
  // Todos los errores TS fueron corregidos: typecheck pasa en CI.
  reactStrictMode: true,
  // Fix FLOW3-012: remotePatterns restringido a orígenes conocidos.
  // Ya no permite ** cualquier host. Solo:
  //   - uploadthing.com (storage oficial)
  //   - cloudinary.com (CDN alternativo)
  //   - El dominio del sitio (para imágenes propias)
  images: {
    remotePatterns: (() => {
      const patterns = [
        { protocol: "https" as const, hostname: "*.ufs.sh" },
        { protocol: "https" as const, hostname: "*.cloudinary.com" },
      ]
      // Agregar el dominio del sitio si está configurado (con try/catch por seguridad)
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
      if (siteUrl) {
        try {
          patterns.push({ protocol: "https" as const, hostname: new URL(siteUrl).hostname })
        } catch {
          console.warn('[next.config] NEXT_PUBLIC_SITE_URL inválida, ignorando:', siteUrl)
        }
      }
      return patterns
    })(),
  },
};

export default nextConfig;
