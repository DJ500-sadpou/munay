import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Definir rutas públicas para que Clerk no intente redirigir a sign-in
// en herramientas de auditoría o scanners sin cookies.
// El auth real se maneja a nivel de página (requireUser / requireAdmin).
const isPublicRoute = createRouteMatcher([
  '/',
  '/catalogo(.*)',
  '/carrito(.*)',
  '/checkout(.*)',
  '/flash(.*)',
  '/p/(.*)',
  '/admin/login(.*)',
  '/cuenta/login(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  // NO protegemos rutas aquí — el auth se maneja a nivel de página
  // con requireUser() / requireAdmin().
  // Pero Clerk necesita conocer las rutas públicas para su sistema
  // de routing interno y evitar redirect loops con audit tools.
  if (!isPublicRoute(request)) {
    // auth().protect() NO se llama — las páginas individuales
    // hacen requireAdmin()/requireUser() según corresponda.
    // Solo registramos que la ruta no es pública para Clerk.
  }
})

export const config = {
  matcher: [
    '/((?!.*\\..*|_next|favicon.ico|logo.svg|robots.txt|sitemap.xml).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
}
