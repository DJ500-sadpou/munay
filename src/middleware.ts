import { clerkMiddleware } from '@clerk/nextjs/server'

// Fix CRIT-1: middleware Clerk para sesiones.
// NO usamos auth.protect() — las páginas individuales hacen requireUser()/requireAdmin()
// que redirigen a login si no hay sesión. Esto evita 404 en keyless mode y permite
// rutas públicas (catalogo, checkout, login pages) sin auth.
export default clerkMiddleware()

export const config = {
  matcher: [
    '/((?!.*\\..*|_next|favicon.ico|logo.svg|robots.txt|sitemap.xml).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
}
