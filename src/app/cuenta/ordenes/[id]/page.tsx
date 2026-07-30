import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Package, CreditCard, MapPin, Sparkles } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { queryOne, query, isDbConfigured } from '@/lib/db/neon'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatCents, formatDate } from '@/lib/format'

export const metadata = { title: 'Detalle de orden · Munay' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function MyOrderDetailPage({ params }: PageProps) {
  const user = await requireUser()
  const { id } = await params

  if (!isDbConfigured()) notFound()

  // Fix CRIT-4: query directa con Neon, filtro por propietario en WHERE.
  // Fix PERM2-013: previene IDOR — si la orden no es del usuario, notFound.
  const order = await queryOne<any>(`
    SELECT * FROM orders
    WHERE id = $1 AND (user_id = $2 OR customer_email = $3)
  `, [id, user.id, user.email])

  if (!order) notFound()

  const items = await query<any>(`
    SELECT oi.id, oi.qty, oi.unit_price_cents, p.slug, p.title
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = $1
  `, [id])

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-primary">Pagada</Badge>
      case 'cancelled': return <Badge variant="destructive">Cancelada</Badge>
      case 'refunded': return <Badge variant="secondary">Reembolsada</Badge>
      default: return <Badge variant="outline">Pendiente</Badge>
    }
  }

  return (
    <div className="bg-gradient-to-b from-white via-munay-crema/10 to-white">
      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link href="/cuenta/ordenes">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Volver a mis órdenes
          </Link>
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink">
              Orden <span className="font-mono text-xl text-munay-ink/70">{order.id.slice(0, 8)}…</span>
            </h1>
            <p className="mt-1 text-sm text-munay-ink/60">
              Realizada: {formatDate(order.created_at)}
            </p>
          </div>
          {statusBadge(order.status)}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card className="border-black/5 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-munay-ink/60 flex items-center gap-2">
                <MapPin className="h-4 w-4" aria-hidden />
                Envío
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-munay-ink/50">Nombre: </span>{order.shipping_name ?? '—'}</div>
              <div><span className="text-munay-ink/50">Dirección: </span>{order.shipping_address ?? '—'}</div>
              <div><span className="text-munay-ink/50">Ciudad: </span>{order.shipping_city ?? '—'}, {order.shipping_province ?? '—'}</div>
              <div><span className="text-munay-ink/50">Teléfono: </span>{order.shipping_phone ?? '—'}</div>
            </CardContent>
          </Card>

          <Card className="border-black/5 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-munay-ink/60 flex items-center gap-2">
                <CreditCard className="h-4 w-4" aria-hidden />
                Resumen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-munay-ink/60">Subtotal</span>
                <span>{formatCents(order.subtotal_cents)}</span>
              </div>
              {order.discount_cents > 0 && (
                <div className="flex justify-between text-munay-terracota">
                  <span>Descuento</span>
                  <span>−{formatCents(order.discount_cents)}</span>
                </div>
              )}
              {order.points_redeemed > 0 && (
                <div className="flex justify-between">
                  <span className="text-munay-ink/60 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    Puntos usados
                  </span>
                  <span>{order.points_redeemed} pts</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatCents(order.total_cents)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 border-black/5 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-munay-ink/60 flex items-center gap-2">
              <Package className="h-4 w-4" aria-hidden />
              Items ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-munay-ink/50">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium">Producto</th>
                    <th className="px-2 py-2 text-center font-medium">Cant.</th>
                    <th className="px-2 py-2 text-right font-medium">Precio</th>
                    <th className="px-2 py-2 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-2 py-3">
                        {item.slug ? (
                          <Link href={`/p/${item.slug}`} className="text-munay-ink hover:text-munay-terracota transition-colors">
                            {item.title ?? 'Producto'}
                          </Link>
                        ) : (
                          'Producto eliminado'
                        )}
                      </td>
                      <td className="px-2 py-3 text-center">{item.qty}</td>
                      <td className="px-2 py-3 text-right">{formatCents(item.unit_price_cents)}</td>
                      <td className="px-2 py-3 text-right font-medium">
                        {formatCents(item.unit_price_cents * item.qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex gap-3">
          <Button asChild variant="outline">
            <Link href="/cuenta/ordenes">Mis órdenes</Link>
          </Button>
          <Button asChild className="bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
            <Link href="/catalogo">Seguir comprando</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
