/**
 * Landing page — Munay, tu tienda de ropa de confianza.
 *
 * Ropa nueva y de segunda mano, seleccionada con cuidado.
 * Envíos en Ibarra y todo Ecuador.
 * Las rutas funcionales (/catalogo, /carrito, /checkout, etc.) siguen operativas.
 */

import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  Package,
  ShoppingCart,
  Zap,
  CreditCard,
  User,
  ShieldCheck,
  Shirt,
  RefreshCw,
  HeartHandshake,
  Clock,
  Construction,
  MapPin,
  Mail,
  Store,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SITE, ROUTES } from '@/lib/constants'

const VALUES = [
  {
    icon: Shirt,
    title: 'Ropa seleccionada',
    desc: 'Prendas nuevas y de segunda mano, elegidas una por una para garantizar calidad y estilo.',
  },
  {
    icon: RefreshCw,
    title: 'Segunda mano de confianza',
    desc: 'Cada prenda usada es revisada, limpiada y fotografiada. Como nueva, pero más sostenible.',
  },
  {
    icon: Tag,
    title: 'Precios justos',
    desc: 'Ropa de calidad a precios accesibles. Renueva tu guardarropa sin gastar de más.',
  },
  {
    icon: HeartHandshake,
    title: 'Hecho en Ibarra',
    desc: 'Tienda local con envíos en Ibarra y todo Ecuador. Atención personalizada y cercana.',
  },
]

export default function Home() {
  return (
    <div className="relative">
      {/* MAINTENANCE BANNER */}
      <div className="bg-primary/10 border-b border-primary/20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-center gap-2 text-sm text-primary">
          <Construction className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong>Munay está en construcción.</strong> El catálogo y la tienda ya están operativos —{' '}
            <Link href={ROUTES.catalogo} className="underline font-medium hover:no-underline">
              visítalos aquí
            </Link>.
          </span>
        </div>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-accent/5 blur-3xl" aria-hidden />

        <div className="container mx-auto px-4 py-20 sm:py-28 md:py-36 relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              <Store className="mr-1 h-3 w-3" aria-hidden />
              Tienda de ropa nueva y de segunda
            </Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-7xl">
              {SITE.name}
            </h1>
            <p className="mt-4 text-xl text-muted-foreground sm:text-2xl font-display">
              {SITE.tagline}
            </p>
            <p className="mt-6 text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
              {SITE.description}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href={ROUTES.catalogo}>
                  <Package className="mr-2 h-4 w-4" aria-hidden />
                  Ver catálogo
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/flash">
                  <Zap className="mr-2 h-4 w-4" aria-hidden />
                  Ofertas flash
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="border-b border-border/60 bg-secondary/20">
        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="font-display text-3xl font-semibold">Por qué Munay</h2>
            <p className="mt-3 text-muted-foreground">
              Ropa que cuida tu estilo, tu bolsillo y el planeta.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <Card key={v.title} className="border-border/60 hover:border-primary/30 transition-all hover:shadow-md group">
                <CardContent className="p-6 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <v.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold">{v.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* QUICK LINKS */}
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-2xl text-center mb-10">
          <h2 className="font-display text-3xl font-semibold">Ya disponible</h2>
          <p className="mt-3 text-muted-foreground">
            Mientras terminamos los detalles finales, estas secciones ya están operativas.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
          {[
            { href: ROUTES.catalogo, icon: Package, title: 'Catálogo', desc: 'Explora prendas con filtros y búsqueda' },
            { href: ROUTES.carrito, icon: ShoppingCart, title: 'Carrito', desc: 'Agrega prendas y aplica promociones' },
            { href: ROUTES.checkout, icon: CreditCard, title: 'Checkout', desc: 'Compra con pago seguro' },
            { href: '/flash', icon: Zap, title: 'Ofertas flash', desc: 'Descuentos por tiempo limitado' },
            { href: '/cuenta', icon: User, title: 'Mi cuenta', desc: 'Historial de pedidos y puntos' },
            { href: '/admin', icon: ShieldCheck, title: 'Panel admin', desc: 'Gestión de productos y pedidos' },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="group block">
              <Card className="border-border/60 hover:border-primary/40 transition-all hover:shadow-md h-full">
                <CardContent className="flex items-start gap-4 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <l.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-medium group-hover:text-primary transition-colors">{l.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{l.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* INFO + CONTACTO */}
      <section className="border-t border-border/60 bg-secondary/20">
        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" aria-hidden />
            <h2 className="mt-4 font-display text-2xl font-semibold">Próximamente</h2>
            <p className="mt-3 text-muted-foreground">
              Estamos afinando los últimos detalles para ofrecerte la mejor experiencia.
              El catálogo, carrito y checkout ya están operativos — te invitamos a explorarlos.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden />
                {SITE.city}
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" aria-hidden />
                {SITE.email}
              </span>
            </div>
            <div className="mt-8">
              <Button asChild variant="outline" size="sm">
                <Link href={ROUTES.catalogo}>
                  <Package className="mr-2 h-4 w-4" aria-hidden />
                  Ir al catálogo
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
