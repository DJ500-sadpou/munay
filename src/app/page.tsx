/**
 * Landing page — Munay en construcción.
 *
 * Muestra un resumen general de lo que será la tienda y un aviso
 * de que el sitio está en mantenimiento. Las rutas funcionales
 * (/catalogo, /carrito, /checkout, etc.) siguen operativas.
 * La página de avances del proyecto se movió a /info.
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
  Leaf,
  Gem,
  Heart,
  Clock,
  Construction,
  MapPin,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SITE, ROUTES } from '@/lib/constants'

const VALUES = [
  {
    icon: Gem,
    title: 'Piezas únicas',
    desc: 'Objetos ceremoniales, mineralería y artesanías seleccionadas a mano, cada una con su propia historia.',
  },
  {
    icon: Heart,
    title: 'Hecho con intención',
    desc: 'Cada pieza es elegida con cuidado, respetando las tradiciones y el origen de cada objeto.',
  },
  {
    icon: Leaf,
    title: 'Consciente',
    desc: 'Segunda mano y piezas restauradas. Consumo responsable que honra el pasado de cada objeto.',
  },
  {
    icon: User,
    title: 'Comunidad',
    desc: 'Un espacio para coleccionistas, sanadores y buscadores de lo auténtico en Ibarra y Ecuador.',
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
        {/* Decorative gradient blobs */}
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-accent/5 blur-3xl" aria-hidden />

        <div className="container mx-auto px-4 py-20 sm:py-28 md:py-36 relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              <Clock className="mr-1 h-3 w-3" aria-hidden />
              Sitio en mantenimiento
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
                  Explorar catálogo
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/flash">
                  <Zap className="mr-2 h-4 w-4" aria-hidden />
                  Códigos flash
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* VALUES / VISIÓN */}
      <section className="border-b border-border/60 bg-secondary/20">
        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <Badge variant="outline" className="mb-3">Próximamente</Badge>
            <h2 className="font-display text-3xl font-semibold">Un espacio para lo sagrado</h2>
            <p className="mt-3 text-muted-foreground">
              Munay nace como un puente entre quienes buscan objetos con significado y quienes
              crean, restauran y curan a través de ellos.
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
          {/* Catálogo */}
          <Link href={ROUTES.catalogo} className="group block">
            <Card className="border-border/60 hover:border-primary/40 transition-all hover:shadow-md h-full">
              <CardContent className="flex items-start gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <Package className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-medium group-hover:text-primary transition-colors">Catálogo</h3>
                  <p className="text-sm text-muted-foreground mt-1">Explora piezas con filtros y búsqueda</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Carrito */}
          <Link href={ROUTES.carrito} className="group block">
            <Card className="border-border/60 hover:border-primary/40 transition-all hover:shadow-md h-full">
              <CardContent className="flex items-start gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <ShoppingCart className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-medium group-hover:text-primary transition-colors">Carrito</h3>
                  <p className="text-sm text-muted-foreground mt-1">Agrega piezas y aplica códigos flash</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Checkout */}
          <Link href={ROUTES.checkout} className="group block">
            <Card className="border-border/60 hover:border-primary/40 transition-all hover:shadow-md h-full">
              <CardContent className="flex items-start gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <CreditCard className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-medium group-hover:text-primary transition-colors">Checkout</h3>
                  <p className="text-sm text-muted-foreground mt-1">Compra con pago seguro</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Flash */}
          <Link href="/flash" className="group block">
            <Card className="border-border/60 hover:border-primary/40 transition-all hover:shadow-md h-full">
              <CardContent className="flex items-start gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <Zap className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-medium group-hover:text-primary transition-colors">Ofertas flash</h3>
                  <p className="text-sm text-muted-foreground mt-1">Descuentos por tiempo limitado</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Cuenta */}
          <Link href="/cuenta" className="group block">
            <Card className="border-border/60 hover:border-primary/40 transition-all hover:shadow-md h-full">
              <CardContent className="flex items-start gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <User className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-medium group-hover:text-primary transition-colors">Mi cuenta</h3>
                  <p className="text-sm text-muted-foreground mt-1">Historial de órdenes y puntos</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Admin */}
          <Link href="/admin" className="group block">
            <Card className="border-border/60 hover:border-primary/40 transition-all hover:shadow-md h-full">
              <CardContent className="flex items-start gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-medium group-hover:text-primary transition-colors">Panel admin</h3>
                  <p className="text-sm text-muted-foreground mt-1">Gestión de productos y órdenes</p>
                </div>
              </CardContent>
            </Card>
          </Link>
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
