/**
 * /info — Página oculta de avances del proyecto.
 *
 * Contiene el contenido completo de progreso, rutas, checklist y stack.
 * No tiene enlaces desde la UI. Solo accesible escribiendo /info en la URL.
 */

import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  Package,
  ShoppingCart,
  Zap,
  CreditCard,
  Database,
  ShieldCheck,
  CheckCircle2,
  Circle,
  Lock,
  Gift,
  BarChart3,
  Mail,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SITE, ROUTES } from '@/lib/constants'

export const metadata = {
  title: 'Avances · Munay',
  robots: { index: false, follow: false },
}

const ROUTES_OVERVIEW = [
  { href: ROUTES.home, label: 'Inicio', desc: 'Landing + mantenimiento', icon: Sparkles, status: 'listo' },
  { href: ROUTES.catalogo, label: '/catalogo', desc: 'Catálogo en vivo con filtros y búsqueda inteligente', icon: Package, status: 'en vivo' },
  { href: ROUTES.carrito, label: '/carrito', desc: 'Carrito persistente + aplicar promociones', icon: ShoppingCart, status: 'en vivo' },
  { href: ROUTES.checkout, label: '/checkout', desc: 'Crear orden + pago + redimir puntos + Turnstile', icon: CreditCard, status: 'en vivo' },
  { href: '/cuenta', label: '/cuenta', desc: 'Mi cuenta: historial, puntos, perfil', icon: Lock, status: 'en vivo' },
  { href: '/cuenta/puntos', label: '/cuenta/puntos', desc: 'Ledger de puntos con saldo y movimientos', icon: Gift, status: 'en vivo' },
  { href: '/flash/MUNAY10', label: '/flash/[code]', desc: 'Validación real + producto concreto', icon: Zap, status: 'en vivo' },
  { href: '/admin', label: '/admin', desc: 'Panel admin completo (productos + órdenes + flash + métricas)', icon: Lock, status: 'en vivo' },
  { href: '/admin/metrics', label: '/admin/metrics', desc: 'Ventas por día + productos top + KPIs', icon: BarChart3, status: 'en vivo' },
  { href: '/sitemap.xml', label: '/sitemap.xml', desc: 'Sitemap dinámico con productos', icon: Database, status: 'en vivo' },
]

const FASE5_FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Cloudflare Turnstile',
    desc: 'Verificación anti-bot en checkout y validación de flash codes.',
  },
  {
    icon: Database,
    title: 'Auditoría completa',
    desc: 'Tabla audit_log + trigger que registra cambios de status en orders.',
  },
  {
    icon: Clock,
    title: 'Cron de limpieza',
    desc: 'Endpoint /api/cron/expire-orders cancela pedidos pendientes >30 min y libera inventario.',
  },
  {
    icon: Mail,
    title: 'Emails transaccionales',
    desc: 'Confirmación de pedido con diseño branded (vía Brevo en prod, log a consola en dev).',
  },
  {
    icon: Sparkles,
    title: 'SEO + Open Graph',
    desc: 'sitemap.xml dinámico, robots.txt, metadata por producto con OG images, locale es-EC.',
  },
  {
    icon: ShieldCheck,
    title: 'Tests e2e',
    desc: 'Playwright configurado con tests del flujo completo: inicio, catálogo, búsqueda, carrito, login, admin, SEO.',
  },
]

const PHASE5_CHECKLIST = [
  { done: true, label: 'Migración Neon Postgres + Clerk Auth + Brevo Emails' },
  { done: true, label: 'Cloudflare Turnstile (cliente widget + server verify) en checkout y flash validate' },
  { done: true, label: 'Sitemap.xml dinámico con productos' },
  { done: true, label: 'Robots.txt con disallow de rutas privadas' },
  { done: true, label: 'Metadata por producto con Open Graph + Twitter cards' },
  { done: true, label: 'Emails transaccionales (Brevo) — confirmación de pedido' },
  { done: true, label: 'Cron job para expirar pedidos pendientes (>30 min)' },
  { done: true, label: 'Función refund_order (revierte puntos + audita)' },
  { done: true, label: 'Tabla audit_log + trigger en orders' },
  { done: true, label: 'Tests e2e con Playwright (flujo completo + SEO + health checks)' },
  { done: true, label: 'vercel.json con cron schedule configurado' },
  { done: false, label: 'Migración de API routes a Edge Functions (opcional, post-launch)' },
]

const STACK = [
  { name: 'Next.js 16', role: 'Frontend / API routes', icon: Sparkles },
  { name: 'Neon Postgres', role: 'Base de datos serverless', icon: Database },
  { name: 'Clerk', role: 'Autenticación de usuarios', icon: Lock },
  { name: 'Vercel', role: 'Hosting + deploy automático', icon: ShieldCheck },
  { name: 'Brevo', role: 'Emails transaccionales', icon: Mail },
  { name: 'Kushki', role: 'Pasarela de pago (Ecuador)', icon: CreditCard },
]

export default function InfoPage() {
  return (
    <div className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="container mx-auto px-4 py-20 sm:py-28 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              Fase 5/5 · COMPLETO
            </Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              {SITE.name}
              <span className="block text-primary mt-2">{SITE.tagline}</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
              {SITE.description}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href={ROUTES.catalogo}>
                  Ver catálogo
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/flash">
                  <Zap className="mr-2 h-4 w-4" aria-hidden />Códigos flash
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES FASE 5 */}
      <section className="border-b border-border/60 bg-secondary/30">
        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-semibold">Lo nuevo en Fase 5</h2>
            <p className="mt-3 text-muted-foreground">Seguridad, observabilidad, SEO y tests — listo para producción.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FASE5_FEATURES.map((f) => (
              <Card key={f.title} className="border-border/60">
                <CardContent className="p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* STACK */}
      <section className="border-b border-border/60">
        <div className="container mx-auto px-4 py-12">
          <h2 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Stack del proyecto</h2>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {STACK.map((s) => (
              <div key={s.name} className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-card p-4 text-center">
                <s.icon className="h-5 w-5 text-primary" aria-hidden />
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RUTAS DISPONIBLES */}
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold">Rutas</h2>
          <p className="mt-3 text-muted-foreground">Las rutas marcadas como <code className="text-foreground">en vivo</code> operan con datos reales de Neon Postgres.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROUTES_OVERVIEW.map((r) => (
            <Card key={r.href} className="border-border/60 transition-colors hover:border-primary/40">
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><r.icon className="h-5 w-5" aria-hidden /></span>
                  <div><CardTitle className="text-base">{r.label}</CardTitle></div>
                </div>
                <Badge variant={r.status === 'listo' || r.status === 'en vivo' ? 'default' : 'secondary'}>{r.status}</Badge>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">{r.desc}</CardDescription>
                <Button asChild variant="ghost" size="sm" className="mt-3 -ml-2 px-2">
                  <Link href={r.href}>Abrir ruta<ArrowRight className="ml-1 h-3 w-3" aria-hidden /></Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CHECKLIST */}
      <section className="border-t border-border/60 bg-secondary/20">
        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-3xl font-semibold text-center">Checklist Fase 5 · Definition of Done</h2>
            <p className="mt-3 text-center text-muted-foreground">Proyecto completo. Una casilla pendiente es opcional post-launch.</p>
            <ul className="mt-8 space-y-2">
              {PHASE5_CHECKLIST.map((item) => (
                <li key={item.label} className="flex items-start gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* DEPLOYMENT CTA */}
      <section className="container mx-auto px-4 py-16">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary" aria-hidden />
            <h2 className="font-display text-2xl font-semibold">Proyecto listo para producción</h2>
            <p className="max-w-xl text-muted-foreground">
              Tienda completa con 5 fases entregadas: catálogo, carrito, pagos,
              cuentas de usuario, panel admin, métricas, seguridad y observabilidad.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild><Link href={ROUTES.catalogo}>Probar la tienda<ArrowRight className="ml-2 h-4 w-4" aria-hidden /></Link></Button>
              <Button asChild variant="outline"><Link href="/admin/login">Panel admin</Link></Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
