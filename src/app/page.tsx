/**
 * Landing page — Munay (redesign-v1)
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
  Tag,
  Search,
  Hand,
  Truck,
  MapPin,
  Mail,
  CheckCircle2,
  ArrowUpRight,
  Star,
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

const STEPS = [
  {
    icon: Search,
    title: 'Explora',
    desc: 'Navega por nuestro catálogo de prendas nuevas y de segunda mano. Filtra por talla, condición y precio.',
    number: '01',
  },
  {
    icon: Hand,
    title: 'Elige',
    desc: 'Agrega tus favoritas al carrito, aplica códigos flash y decide cuánto quieres ahorrar.',
    number: '02',
  },
  {
    icon: Truck,
    title: 'Recibe',
    desc: 'Completa tu compra con pago seguro y recibe en la puerta de tu casa. Envíos a todo Ecuador.',
    number: '03',
  },
]

const QUICK_LINKS = [
  { href: ROUTES.catalogo, icon: Package, title: 'Catálogo', desc: 'Explora prendas con filtros y búsqueda' },
  { href: ROUTES.carrito, icon: ShoppingCart, title: 'Carrito', desc: 'Agrega prendas y aplica promociones' },
  { href: ROUTES.checkout, icon: CreditCard, title: 'Checkout', desc: 'Compra con pago seguro' },
  { href: '/flash', icon: Zap, title: 'Ofertas flash', desc: 'Descuentos por tiempo limitado' },
  { href: '/cuenta', icon: User, title: 'Mi cuenta', desc: 'Historial de pedidos y puntos' },
  { href: '/admin', icon: ShieldCheck, title: 'Panel admin', desc: 'Gestión de productos y pedidos' },
]

export default function Home() {
  return (
    <div className="relative">
      {/* ===== MAINTENANCE BANNER ===== */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border-b border-primary/10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-center gap-2 text-sm text-primary">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong>Munay está en construcción.</strong> El catálogo y la tienda ya están operativos —{' '}
            <Link href={ROUTES.catalogo} className="underline font-medium hover:no-underline underline-offset-2">
              visítalos aquí
            </Link>
            .
          </span>
        </div>
      </div>

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        {/* Gradientes de fondo */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" aria-hidden />
        <div className="absolute top-0 -right-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[100px]" aria-hidden />
        <div className="absolute -bottom-20 -left-40 h-[400px] w-[400px] rounded-full bg-accent/5 blur-[80px]" aria-hidden />

        <div className="container mx-auto px-4 py-20 sm:py-28 md:py-36 relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium tracking-wide uppercase">
              <Sparkles className="mr-1.5 h-3 w-3" aria-hidden />
              Tienda de ropa nueva y de segunda · Ibarra
            </Badge>

            <h1 className="font-display text-5xl font-bold tracking-tight sm:text-6xl md:text-8xl lg:text-8xl leading-[1.05]">
              <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
                Tu próxima
              </span>
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                prenda favorita
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {SITE.description}
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="group relative overflow-hidden shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                <Link href={ROUTES.catalogo}>
                  <span className="relative z-10 flex items-center gap-2">
                    <Package className="h-4 w-4" aria-hidden />
                    Explorar catálogo
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="group border-2">
                <Link href="/flash">
                  <Zap className="mr-2 h-4 w-4 text-accent" aria-hidden />
                  Ofertas flash
                  <ArrowUpRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                </Link>
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="mt-14 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                Pago seguro
              </span>
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" aria-hidden />
                Envío a todo Ecuador
              </span>
              <span className="flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" aria-hidden />
                Prendas seleccionadas
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="relative border-y border-border/40 bg-gradient-to-b from-background via-secondary/10 to-background">
        <div className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-2xl text-center mb-14">
            <Badge variant="outline" className="mb-4 px-3 py-1 text-xs font-medium">Cómo funciona</Badge>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Tres pasos para{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                renovar tu guardarropa
              </span>
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative group">
                {/* Número decorativo */}
                <div className="absolute -top-4 -right-4 text-7xl font-display font-bold text-primary/[0.04] select-none pointer-events-none">
                  {s.number}
                </div>

                <Card className="border-border/40 hover:border-primary/30 transition-all hover:shadow-lg h-full bg-background/60 backdrop-blur-sm">
                  <CardContent className="p-8">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 text-primary mb-6 shadow-sm group-hover:scale-105 transition-transform">
                      <s.icon className="h-7 w-7" aria-hidden />
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        {s.number}
                      </span>
                      <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
                  </CardContent>
                </Card>

                {/* Conector entre pasos */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -translate-y-1/2 -right-6 z-10 text-primary/20">
                    <ArrowRight className="h-6 w-6" aria-hidden />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button asChild variant="ghost" size="sm" className="group">
              <Link href={ROUTES.catalogo}>
                Comienza a explorar
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ===== VALUES ===== */}
      <section className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl text-center mb-14">
          <Badge variant="outline" className="mb-4 px-3 py-1 text-xs font-medium">Por qué Munay</Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
            Ropa que cuida tu estilo,{' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              tu bolsillo y el planeta
            </span>
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
          {VALUES.map((v) => (
            <Card
              key={v.title}
              className="group relative overflow-hidden border-border/40 hover:border-primary/30 transition-all hover:shadow-xl hover:-translate-y-1"
            >
              {/* Hover gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-accent/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
              <CardContent className="relative p-8 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 text-primary group-hover:from-primary group-hover:to-accent group-hover:text-primary-foreground transition-all duration-300 shadow-sm">
                  <v.icon className="h-7 w-7" aria-hidden />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold">{v.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ===== QUICK LINKS ===== */}
      <section className="border-t border-border/40 bg-gradient-to-b from-secondary/10 to-background">
        <div className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-2xl text-center mb-14">
            <Badge variant="outline" className="mb-4 px-3 py-1 text-xs font-medium">Ya disponible</Badge>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Todo lo que necesitas,{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                ya operativo
              </span>
            </h2>
            <p className="mt-3 text-muted-foreground">
              Mientras terminamos los detalles finales, estas secciones ya están funcionando.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {QUICK_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="group block">
                <Card className="border-border/40 hover:border-primary/30 transition-all hover:shadow-lg hover:-translate-y-0.5 h-full">
                  <CardContent className="flex items-start gap-5 p-6">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 text-primary group-hover:from-primary group-hover:to-accent group-hover:text-primary-foreground transition-all duration-300 shadow-sm">
                      <l.icon className="h-6 w-6" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-medium group-hover:text-primary transition-colors">{l.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{l.desc}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ml-auto" aria-hidden />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CONTACT / CTA FINAL ===== */}
      <section className="relative overflow-hidden border-t border-border/40">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/[0.02] to-primary/5" aria-hidden />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[600px] rounded-full bg-primary/5 blur-[80px]" aria-hidden />

        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-accent/10 shadow-sm">
              <Sparkles className="h-8 w-8 text-primary" aria-hidden />
            </div>
            <h2 className="mt-6 font-display text-3xl sm:text-4xl font-bold tracking-tight">
              ¿Listo para{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                renovar tu estilo
              </span>
              ?
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Explora nuestro catálogo de prendas nuevas y de segunda mano, seleccionadas con cuidado para ti.
              Envíos en Ibarra y todo Ecuador.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                <Link href={ROUTES.catalogo}>
                  <Package className="mr-2 h-4 w-4" aria-hidden />
                  Ir al catálogo
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={ROUTES.checkout}>
                  <CreditCard className="mr-2 h-4 w-4" aria-hidden />
                  Ir al checkout
                </Link>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary/60" aria-hidden />
                {SITE.city}
              </span>
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary/60" aria-hidden />
                {SITE.email}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
