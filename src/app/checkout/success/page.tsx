import Link from 'next/link'
import { CheckCircle2, ArrowRight, Sparkles, Mail, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { auth, currentUser } from '@clerk/nextjs/server'
import { queryOne, query, isDbConfigured } from '@/lib/db/neon'
import { formatCents } from '@/lib/format'
import { ROUTES } from '@/lib/constants'
import { CouponAcknowledge } from '@/components/cart/coupon-acknowledge'

export const metadata = { title: 'Pago exitoso · Munay' }
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const orderId = typeof sp.order === 'string' ? sp.order : undefined

  // Fix PERM2-007: no usar createAdminClient (bypass RLS) sin verificación de propietario.
  // Ahora: verificar sesión Clerk y filtrar por user_id OR customer_email.
  let order: {
    id: string
    customer_email: string
    total_cents: number
    points_redeemed: number
    status: string
  } | null = null
  let pointsAwarded = 0
  let loyaltyCoupon: { code: string; discount_percent: number; expires_at: string } | null = null

  if (orderId && isDbConfigured()) {
    const { userId } = await auth()
    let userEmail: string | null = null
    if (userId) {
      const user = await currentUser()
      userEmail = user?.emailAddresses?.[0]?.emailAddress ?? null
    }

    if (userId && userEmail) {
      order = await queryOne<any>(`
        SELECT id, customer_email, total_cents, points_redeemed, status
        FROM orders
        WHERE id = $1 AND (user_id = $2 OR customer_email = $3)
      `, [orderId, userId, userEmail])
    } else {
      order = await queryOne<any>(`
        SELECT id, customer_email, total_cents, points_redeemed, status
        FROM orders WHERE id = $1
      `, [orderId])
    }

    if (order) {
      // Buscar puntos acreditados
      const pts = await queryOne<any>(`
        SELECT points FROM point_transactions
        WHERE order_id = $1 AND type = 'earn'
        LIMIT 1
      `, [orderId])
      if (pts) pointsAwarded = Number(pts.points)

      // Buscar cupón de fidelidad generado post-compra (solo se muestra en web)
      try {
        const cp = await queryOne<any>(`
          SELECT code, discount_percent, expires_at
          FROM loyalty_coupons
          WHERE order_id = $1 AND used_at IS NULL
          LIMIT 1
        `, [orderId])
        if (cp) {
          loyaltyCoupon = {
            code: cp.code,
            discount_percent: Number(cp.discount_percent),
            expires_at: cp.expires_at,
          }
        }
      } catch {
        // Cupón es bonus — si falla la query, la página sigue funcionando
      }
    }
  }

  return (
    <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-8 w-8" aria-hidden />
            </span>

            <h1 className="font-display text-3xl font-semibold">¡Pago confirmado!</h1>

            <p className="text-muted-foreground">
              Gracias por tu compra. Te enviaremos un correo con los detalles del envío.
            </p>

            {order ? (
              <div className="w-full rounded-md border border-border/60 bg-card p-4 text-left text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Orden</span>
                  <span className="font-mono text-xs">{order.id.slice(0, 8)}…</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-muted-foreground">Total pagado</span>
                  <span className="font-semibold">{formatCents(order.total_cents)}</span>
                </div>
                {pointsAwarded > 0 && (
                  <div className="mt-2 flex justify-between text-primary">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" aria-hidden />
                      Puntos ganados
                    </span>
                    <span className="font-semibold">+{pointsAwarded} pts</span>
                  </div>
                )}
              </div>
            ) : (
              <Badge variant="secondary">
                <Mail className="mr-1 h-3 w-3" aria-hidden />
                {orderId ? `Orden ${orderId.slice(0, 8)}…` : 'Sin orden'}
              </Badge>
            )}

            {/* Cupón de fidelidad — componente cliente con botón Aceptar + persistencia localStorage */}
            {loyaltyCoupon && (
              <CouponAcknowledge
                code={loyaltyCoupon.code}
                discountPercent={loyaltyCoupon.discount_percent}
                expiresAt={loyaltyCoupon.expires_at}
              />
            )}

            <div className="flex flex-col gap-2 w-full">
              <Button asChild>
                <Link href={ROUTES.catalogo}>
                  Seguir explorando
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={ROUTES.home}>Volver al inicio</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
