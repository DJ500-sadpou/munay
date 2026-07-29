import Link from 'next/link'
import { ArrowLeft, Package, Calendar } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { query } from '@/lib/db/neon'
import { isDbConfigured } from '@/lib/db/neon'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCents, formatDate } from '@/lib/format'

export const metadata = { title: 'Mis órdenes · Munay' }
export const dynamic = 'force-dynamic'

export default async function MyOrdersPage() {
  const user = await requireUser('/cuenta/ordenes')

  let orders: Array<{
    id: string
    status: string
    total_cents: number
    created_at: string
    items_count: number
  }> = []

  if (isDbConfigured()) {
    // Fix CRIT-4: query directa con Neon (sin stub Supabase).
    // Filtro por user_id O customer_email para incluir órdenes guest previas.
    orders = await query<any>(`
      SELECT o.id, o.status, o.total_cents, o.created_at,
             (SELECT count(*) FROM order_items WHERE order_id = o.id) AS items_count
      FROM orders o
      WHERE o.user_id = $1 OR o.customer_email = $2
      ORDER BY o.created_at DESC
    `, [user.id, user.email])
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-primary">Pagada</Badge>
      case 'cancelled': return <Badge variant="destructive">Cancelada</Badge>
      case 'refunded': return <Badge variant="secondary">Reembolsada</Badge>
      default: return <Badge variant="outline">Pendiente</Badge>
    }
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/cuenta">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Volver a mi cuenta
        </Link>
      </Button>

      <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">Mis órdenes</h1>
      <p className="text-muted-foreground mb-8">
        {orders.length} {orders.length === 1 ? 'orden' : 'órdenes'} registradas.
      </p>

      {orders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="text-muted-foreground">Aún no tienes órdenes.</p>
            <Button asChild>
              <Link href="/catalogo">Explorar catálogo</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Card key={o.id} className="border-border/60 hover:border-primary/40 transition-colors">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="text-sm font-medium font-mono">{o.id.slice(0, 8)}…</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(o.created_at, { dateStyle: 'medium', timeStyle: 'short' })} · {o.items_count} {o.items_count === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">{formatCents(o.total_cents)}</span>
                  {statusBadge(o.status)}
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/cuenta/ordenes/${o.id}`}>Ver detalle</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
