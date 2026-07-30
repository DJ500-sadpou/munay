import Link from 'next/link'
import { Plus, Package, LogOut, Sparkles, ShoppingCart, DollarSign, TrendingUp, Zap, BarChart3, Gift, Percent, MessageCircle } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { query, queryOne, isDbConfigured } from '@/lib/db/neon'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCents } from '@/lib/format'
import { getLoyaltyConfig, getLoyaltyStats } from '@/lib/queries/loyalty-coupons'
import { LoyaltyToggle } from '@/components/admin/loyalty-toggle'

export const metadata = {
  title: 'Admin · Munay',
}

export const dynamic = 'force-dynamic'

export default async function AdminHomePage() {
  const admin = await requireAdmin()

  let products: Array<{
    id: string
    slug: string
    title: string
    price_cents: number
    condition: string
    grading: string | null
    active: boolean
    stock: number | null
  }> = []
  let ordersCount = 0
  let paidOrdersCount = 0
  let totalRevenueCents = 0
  let flashCodesActive = 0
  let loyaltyConfig = await getLoyaltyConfig()
  let loyaltyStats = await getLoyaltyStats()

  if (isDbConfigured()) {
    // Fix CRIT-4: queries Neon directas.
    const productRows = await query<any>(`
      SELECT
        p.id, p.slug, p.title, p.price_cents, p.condition, p.grading, p.active,
        COALESCE(i.stock, 0) AS stock
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id
      ORDER BY p.created_at DESC
    `)
    products = productRows.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      price_cents: Number(p.price_cents),
      condition: p.condition,
      grading: p.grading,
      active: p.active,
      stock: p.stock !== null ? Number(p.stock) : null,
    }))

    const statsRow = await queryOne<any>(`
      SELECT
        (SELECT count(*) FROM orders) AS orders,
        (SELECT count(*) FROM orders WHERE status = 'paid') AS paid,
        (SELECT COALESCE(sum(total_cents), 0) FROM orders WHERE status = 'paid') AS revenue,
        (SELECT count(*) FROM flash_codes WHERE active = true) AS flash_active
    `)
    ordersCount = Number(statsRow?.orders ?? 0)
    paidOrdersCount = Number(statsRow?.paid ?? 0)
    totalRevenueCents = Number(statsRow?.revenue ?? 0)
    flashCodesActive = Number(statsRow?.flash_active ?? 0)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="mb-3 inline-block rounded-full bg-munay-terracota/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-munay-terracota">
            Panel admin
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink">
            Panel administrativo
          </h1>
          <p className="mt-2 text-munay-ink/60">
            Hola, <strong>{admin.email}</strong>. Gestiona el catálogo desde aquí.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/orders">
              <ShoppingCart className="mr-2 h-4 w-4" aria-hidden />
              Órdenes
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/tickets">
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
              Tickets
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/flash-codes">
              <Zap className="mr-2 h-4 w-4" aria-hidden />
              Flash codes ({flashCodesActive})
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/metrics">
              <BarChart3 className="mr-2 h-4 w-4" aria-hidden />
              Métricas
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Nuevo producto
            </Link>
          </Button>
          <form action="/api/auth/logout?next=/admin/login" method="POST">
            <Button type="submit" variant="outline">
              <LogOut className="mr-2 h-4 w-4" aria-hidden />
              Salir
            </Button>
          </form>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" aria-hidden />
              Productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{products.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {products.filter((p) => p.active).length} activos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" aria-hidden />
              Órdenes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{ordersCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {paidOrdersCount} pagadas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" aria-hidden />
              Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{formatCents(totalRevenueCents)}</p>              <p className="mt-1 text-xs text-munay-ink/60">de órdenes pagadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" aria-hidden />
              Conversión
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {ordersCount > 0 ? Math.round((paidOrdersCount / ordersCount) * 100) : 0}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">pagadas / total</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de productos */}
      <div className="mt-10">
        <h2 className="font-display text-xl font-semibold mb-4">Productos</h2>
        {products.length === 0 ? (
          <Card className="border-dashed border-black/10">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Package className="h-10 w-10 text-munay-ink/30" aria-hidden />
              <p className="text-munay-ink/60">Aún no hay productos. Crea el primero.</p>
              <Button asChild>
                <Link href="/admin/products/new">
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  Nuevo producto
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-black/5 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-munay-cream/30 text-xs uppercase tracking-wider text-munay-ink/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Título</th>
                  <th className="px-4 py-3 text-left font-medium">Slug</th>
                  <th className="px-4 py-3 text-right font-medium">Precio</th>
                  <th className="px-4 py-3 text-center font-medium">Condición</th>
                  <th className="px-4 py-3 text-center font-medium">Stock</th>
                  <th className="px-4 py-3 text-center font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-munay-cream/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{p.title}</td>
                    <td className="px-4 py-3 font-mono text-xs text-munay-ink/50">{p.slug}</td>
                    <td className="px-4 py-3 text-right">{formatCents(p.price_cents)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={p.condition === 'new' ? 'default' : 'secondary'}>
                        {p.condition === 'new' ? 'Nuevo' : 'Usado'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">{p.stock ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={p.active ? 'default' : 'outline'}>
                        {p.active ? 'Activo' : 'Oculto'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/products/${p.id}`}>Editar</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cupones de fidelidad */}
      <div className="mt-10">
        <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
          <Gift className="h-5 w-5" aria-hidden />
          Cupones de fidelidad
        </h2>
        <LoyaltyToggle
          initialEnabled={loyaltyConfig.enabled}
          initialMin={loyaltyConfig.min_discount_percent}
          initialMax={loyaltyConfig.max_discount_percent}
        />          <div className="flex gap-4 mt-4 text-sm">
          <div className="rounded-lg border border-black/5 bg-white px-4 py-3 text-center shadow-sm">
            <p className="text-2xl font-bold">{loyaltyStats.generated}</p>
            <p className="text-xs text-muted-foreground">cupones generados</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card px-4 py-3 text-center">
            <p className="text-2xl font-bold">{loyaltyStats.used}</p>
            <p className="text-xs text-muted-foreground">cupones usados</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card px-4 py-3 text-center">
            <p className="text-2xl font-bold">{loyaltyStats.usageRate}%</p>
            <p className="text-xs text-muted-foreground">tasa de uso</p>
          </div>
        </div>
      </div>
    </div>
  )
}
