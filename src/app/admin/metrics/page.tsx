import Link from 'next/link'
import { ArrowLeft, TrendingUp, ShoppingCart, Package, Sparkles, DollarSign, Calendar } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { query, queryOne, isDbConfigured } from '@/lib/db/neon'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCents, formatDate } from '@/lib/format'

export const metadata = { title: 'Métricas · Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminMetricsPage() {
  await requireAdmin()

  let salesLast30Days: Array<{ date: string; total: number; count: number }> = []
  let topProducts: Array<{ title: string; slug: string; qty: number; revenue: number }> = []
  let totalCustomers = 0
  let totalPointsAwarded = 0
  let avgOrderValue = 0
  let paidCount = 0

  if (isDbConfigured()) {
    // Fix CRIT-4: queries directas Neon con agregaciones SQL.
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const salesRows = await query<any>(`
      SELECT date_trunc('day', created_at) AS date,
             SUM(total_cents) AS total,
             COUNT(*) AS count
      FROM orders
      WHERE status = 'paid' AND created_at >= $1
      GROUP BY date_trunc('day', created_at)
      ORDER BY date ASC
    `, [thirtyDaysAgo.toISOString()])

    salesLast30Days = salesRows.map((r) => ({
      date: r.date,
      total: Number(r.total),
      count: Number(r.count),
    }))

    if (salesLast30Days.length > 0) {
      const totalRevenue = salesLast30Days.reduce((s, d) => s + d.total, 0)
      const totalCount = salesLast30Days.reduce((s, d) => s + d.count, 0)
      avgOrderValue = totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0
      paidCount = totalCount
    }

    const topRows = await query<any>(`
      SELECT p.slug, p.title,
             SUM(oi.qty) AS qty,
             SUM(oi.qty * oi.unit_price_cents) AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id AND o.status = 'paid'
      JOIN products p ON p.id = oi.product_id
      GROUP BY p.slug, p.title
      ORDER BY qty DESC
      LIMIT 10
    `)
    topProducts = topRows.map((r) => ({
      title: r.title,
      slug: r.slug,
      qty: Number(r.qty),
      revenue: Number(r.revenue),
    }))

    const custRow = await queryOne<any>(`SELECT count(*) AS count FROM customers`)
    totalCustomers = Number(custRow?.count ?? 0)

    const ptsRow = await queryOne<any>(`SELECT COALESCE(SUM(points), 0) AS total FROM point_transactions WHERE type = 'earn'`)
    totalPointsAwarded = Number(ptsRow?.total ?? 0)
  }

  const maxDayTotal = Math.max(...salesLast30Days.map((d) => d.total), 1)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Volver al panel
        </Link>
      </Button>

      <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink mb-2">Métricas</h1>
      <p className="text-munay-ink/60 mb-8">
        Resumen de ventas, productos y engagement de los últimos 30 días.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" aria-hidden />
              Ingresos (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {formatCents(salesLast30Days.reduce((s, d) => s + d.total, 0))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{paidCount} órdenes pagadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" aria-hidden />
              Ticket promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCents(avgOrderValue)}</p>
            <p className="mt-1 text-xs text-muted-foreground">por orden pagada</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" aria-hidden />
              Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalCustomers}</p>
            <p className="mt-1 text-xs text-muted-foreground">registrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4" aria-hidden />
              Puntos otorgados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{totalPointsAwarded}</p>
            <p className="mt-1 text-xs text-muted-foreground">total acumulado</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" aria-hidden />
            Ventas diarias (últimos 30 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {salesLast30Days.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Package className="mx-auto h-10 w-10 mb-3 opacity-50" aria-hidden />
              No hay ventas en los últimos 30 días.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-end gap-1 h-48 border-b border-border">
                {salesLast30Days.map((d) => {
                  const heightPct = (d.total / maxDayTotal) * 100
                  return (
                    <div
                      key={d.date}
                      role="img"
                      aria-label={`${formatDate(d.date, { dateStyle: 'medium' })}: ${formatCents(d.total)}, ${d.count} órdenes`}
                      className="flex-1 group relative bg-primary/20 hover:bg-primary/40 rounded-t transition-colors"
                      style={{ height: `${Math.max(2, heightPct)}%` }}
                      title={`${formatDate(d.date, { dateStyle: 'medium' })}: ${formatCents(d.total)} (${d.count} órdenes)`}
                    >
                      <div className="absolute inset-x-0 bottom-full mb-1 hidden group-hover:block bg-foreground text-background text-xs px-2 py-1 rounded whitespace-nowrap">
                        {formatCents(d.total)}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatDate(salesLast30Days[0]?.date, { dateStyle: 'short' })}</span>
                <span>{formatDate(salesLast30Days[salesLast30Days.length - 1]?.date, { dateStyle: 'short' })}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" aria-hidden />
            Productos más vendidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No hay ventas registradas todavía.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium">#</th>
                    <th className="px-2 py-2 text-left font-medium">Producto</th>
                    <th className="px-2 py-2 text-center font-medium">Unidades</th>
                    <th className="px-2 py-2 text-right font-medium">Ingresos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {topProducts.map((p, i) => (
                    <tr key={p.slug}>
                      <td className="px-2 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-3">
                        <Link href={`/p/${p.slug}`} className="hover:text-primary transition-colors">
                          {p.title}
                        </Link>
                      </td>
                      <td className="px-2 py-3 text-center font-medium">{p.qty}</td>
                      <td className="px-2 py-3 text-right font-medium">{formatCents(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
