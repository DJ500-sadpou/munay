import Link from 'next/link'
import { ArrowLeft, Package, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { query, isDbConfigured } from '@/lib/db/neon'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCents, formatDate } from '@/lib/format'

export const metadata = { title: 'Órdenes · Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminOrdersPage() {
  await requireAdmin()

  let orders: Array<{
    id: string
    customer_email: string
    status: string
    total_cents: number
    created_at: string
    items_count: number
  }> = []

  if (isDbConfigured()) {
    // Fix CRIT-4: query directa Neon con subquery para items_count.
    const rows = await query<any>(`
      SELECT o.id, o.customer_email, o.status, o.total_cents, o.created_at,
             (SELECT count(*) FROM order_items WHERE order_id = o.id) AS items_count
      FROM orders o
      ORDER BY o.created_at DESC
      LIMIT 100
    `)
    orders = rows.map((r) => ({
      id: r.id,
      customer_email: r.customer_email,
      status: r.status,
      total_cents: Number(r.total_cents),
      created_at: r.created_at,
      items_count: Number(r.items_count),
    }))
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-primary"><CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />Pagada</Badge>
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" aria-hidden />Cancelada</Badge>
      case 'refunded':
        return <Badge variant="secondary">Reembolsada</Badge>
      default:
        return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" aria-hidden />Pendiente</Badge>
    }
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Volver al panel
        </Link>
      </Button>

      <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">Órdenes</h1>
      <p className="text-muted-foreground mb-8">
        {orders.length} {orders.length === 1 ? 'orden registrada' : 'órdenes registradas'}.
      </p>

      {orders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="text-muted-foreground">Aún no hay órdenes. Cuando alguien compre, aparecerán aquí.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Orden</th>
                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                <th className="px-4 py-3 text-center font-medium">Items</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3">{o.customer_email}</td>
                  <td className="px-4 py-3 text-center">{o.items_count}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCents(o.total_cents)}</td>
                  <td className="px-4 py-3 text-center">{statusBadge(o.status)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(o.created_at, { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/admin/orders/${o.id}`}>Ver</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
