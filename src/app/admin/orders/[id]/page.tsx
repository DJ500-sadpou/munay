import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, Package, CreditCard, User, MapPin, Sparkles,
  MessageCircle, CheckCircle, Loader2,
} from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { queryOne, query, isDbConfigured } from '@/lib/db/neon'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatCents, formatDate } from '@/lib/format'
import { MarkAsPaidButton } from './mark-paid-button'

export const metadata = { title: 'Detalle de orden · Admin' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  await requireAdmin()

  if (!isDbConfigured()) notFound()

  const { id } = await params

  // Fix CRIT-4: query directa Neon (sin stub con select anidado).
  const order = await queryOne<any>(`
    SELECT * FROM orders WHERE id = $1
  `, [id])
  if (!order) notFound()

  const items = await query<any>(`
    SELECT oi.id, oi.qty, oi.unit_price_cents, p.slug, p.title
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = $1
  `, [id])

  const payments = await query<any>(`
    SELECT id, provider, provider_ref, status, created_at
    FROM payments WHERE order_id = $1 ORDER BY created_at DESC
  `, [id])

  // Buscar ticket asociado a la orden
  const ticket = await queryOne<any>(`
    SELECT id, name, email, phone, message, status, created_at
    FROM tickets WHERE order_id = $1 LIMIT 1
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
    <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin/orders">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Volver a órdenes
        </Link>
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink">
            Orden <span className="font-mono text-xl text-munay-ink/50">{order.id.slice(0, 8)}…</span>
          </h1>
          <p className="mt-1 text-sm text-munay-ink/60">
            Creada: {formatDate(order.created_at)}
          </p>
        </div>
        {statusBadge(order.status)}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" aria-hidden />
              Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{order.customer_email}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" aria-hidden />
              Envío
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Nombre: </span>{order.shipping_name ?? '—'}</div>
            <div><span className="text-muted-foreground">Dirección: </span>{order.shipping_address ?? '—'}</div>
            <div><span className="text-muted-foreground">Ciudad: </span>{order.shipping_city ?? '—'}, {order.shipping_province ?? '—'}</div>
            <div><span className="text-muted-foreground">Teléfono: </span>{order.shipping_phone ?? '—'}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4" aria-hidden />
            Resumen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCents(order.subtotal_cents)}</span>
          </div>
          {order.discount_cents > 0 && (
            <div className="flex justify-between text-primary">
              <span>Descuento</span>
              <span>−{formatCents(order.discount_cents)}</span>
            </div>
          )}
          {order.points_redeemed > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
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

      {/* Ticket asociado (WhatsApp) */}
      {ticket && (
        <Card className="mt-6 border-[#25D366]/15">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#25D366]" aria-hidden />
              Ticket WhatsApp · <span className="font-mono text-xs">{ticket.id.slice(0, 8)}…</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente</span>
              <span>{ticket.name} ({ticket.email})</span>
            </div>
            {ticket.phone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Teléfono</span>
                <a
                  href={`https://wa.me/${ticket.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#25D366] hover:underline"
                >
                  {ticket.phone} ↗
                </a>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado ticket</span>
              <Badge variant={ticket.status === 'completed' ? 'default' : ticket.status === 'cancelled' ? 'destructive' : 'secondary'}>
                {ticket.status === 'new' ? 'Nuevo' : ticket.status === 'in_progress' ? 'En progreso' : ticket.status === 'completed' ? 'Completado' : 'Cancelado'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Creado</span>
              <span>{formatDate(ticket.created_at)}</span>
            </div>
            <Link
              href="/admin/tickets"
              className="mt-2 inline-flex items-center gap-1 text-xs text-munay-terracota hover:text-munay-terracota-quemado transition-colors"
            >
              Ver todos los tickets →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Botón Marcar como pagada (solo si está pendiente) */}
      {order.status === 'pending' && (
        <Card className="mt-6 border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle className="h-8 w-8 text-primary" aria-hidden />
            <div>
              <p className="font-medium text-munay-ink">¿Pago confirmado por WhatsApp?</p>
              <p className="text-sm text-munay-ink/60">
                Marca la orden como pagada cuando hayas confirmado el pago con el cliente.
                Esto liberará el inventario y otorgará los puntos de fidelidad.
              </p>
            </div>
            <MarkAsPaidButton orderId={order.id} />
          </CardContent>
        </Card>
      )}

      {payments.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pagos ({payments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {payments.map((p) => (
              <div key={p.id} className="rounded-md border border-border/60 p-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pasarela</span>
                  <span className="font-medium uppercase">{p.provider}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Referencia</span>
                  <span className="font-mono text-xs">{p.provider_ref ?? '—'}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Estado</span>
                  <Badge variant="outline">{p.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Package className="h-4 w-4" aria-hidden />
            Items ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">Producto</th>
                  <th className="px-2 py-2 text-center font-medium">Cant.</th>
                  <th className="px-2 py-2 text-right font-medium">Precio unit.</th>
                  <th className="px-2 py-2 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {items.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-2 py-3">
                      {item.slug ? (
                        <Link href={`/p/${item.slug}`} className="hover:text-primary transition-colors">
                          {item.title ?? 'Producto eliminado'}
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
    </div>
  )
}
