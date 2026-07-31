import Link from 'next/link'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { auth, currentUser } from '@clerk/nextjs/server'
import { queryOne, isDbConfigured } from '@/lib/db/neon'
import { formatCents } from '@/lib/format'
import { ROUTES, SITE } from '@/lib/constants'
import { AutoWhatsappRedirect } from './auto-whatsapp'

export const metadata = { title: 'Pedido enviado · Munay' }
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const orderId = typeof sp.order === 'string' ? sp.order : undefined
  const waUrl = typeof sp.wa === 'string' ? decodeURIComponent(sp.wa) : null

  let order: {
    id: string
    customer_email: string
    total_cents: number
    status: string
  } | null = null
  let whatsappUrl: string | null = waUrl

  if (orderId && isDbConfigured()) {
    const { userId } = await auth()
    let userEmail: string | null = null
    if (userId) {
      const user = await currentUser()
      userEmail = user?.emailAddresses?.[0]?.emailAddress ?? null
    }

    if (userId && userEmail) {
      order = await queryOne<any>(`
        SELECT id, customer_email, total_cents, status
        FROM orders
        WHERE id = $1 AND (user_id = $2 OR customer_email = $3)
      `, [orderId, userId, userEmail])
    } else {
      order = await queryOne<any>(`
        SELECT id, customer_email, total_cents, status
        FROM orders WHERE id = $1
      `, [orderId])
    }

    // Si no se recibió wa URL del checkout, construir una con el ID de la orden
    if (!whatsappUrl && order) {
      const msg = encodeURIComponent(
        `¡Hola! Quiero consultar sobre mi pedido ${orderId.slice(0, 8)}… en Munay. 🙌`
      )
      whatsappUrl = `https://wa.me/${SITE.whatsapp}?text=${msg}`
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="border-munay-whatsapp/15 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-munay-whatsapp/10 text-munay-whatsapp">
              <MessageCircle className="h-8 w-8" aria-hidden />
            </span>

            <h1 className="font-display text-3xl font-semibold text-munay-ink">¡Pedido enviado!</h1>

            <p className="text-munay-ink/60">
              Hemos recibido tu pedido. Un asesor se pondrá en contacto contigo por
              WhatsApp para coordinar el pago y el envío.
            </p>

            {order ? (
              <div className="w-full rounded-md border border-black/5 bg-white p-4 text-left text-sm">
                <div className="flex justify-between">
                  <span className="text-munay-ink/60">Orden</span>
                  <span className="font-mono text-xs">{order.id.slice(0, 8)}…</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-munay-ink/60">Total estimado</span>
                  <span className="font-semibold">{formatCents(order.total_cents)}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-munay-ink/60">Estado</span>
                  <Badge variant="outline">
                    {order.status === 'pending' ? 'Esperando pago' : order.status}
                  </Badge>
                </div>
              </div>
            ) : (
              <Badge variant="secondary">
                {orderId ? `Orden ${orderId.slice(0, 8)}…` : 'Pedido registrado'}
              </Badge>
            )}

            {/* Auto-redirect a WhatsApp */}
            {whatsappUrl && <AutoWhatsappRedirect whatsappUrl={whatsappUrl} orderId={orderId} />}

            <div className="flex flex-col gap-2 w-full">
              {whatsappUrl && (
                <Button
                  asChild
                  className="bg-munay-whatsapp text-white hover:bg-munay-whatsapp/90"
                >
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
                    Abrir WhatsApp
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </a>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href={ROUTES.catalogo}>
                  Seguir explorando
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href={ROUTES.home}>Volver al inicio</Link>
              </Button>
            </div>

            <p className="text-xs text-munay-ink/50">
              ¿No te contactamos en 24h? Escríbenos directamente a{' '}
              <a
                href={SITE.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-munay-whatsapp underline underline-offset-2"
              >
                WhatsApp
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
