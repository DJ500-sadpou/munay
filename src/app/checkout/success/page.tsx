import Link from 'next/link'
import { ArrowRight, MessageCircle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { auth, currentUser } from '@clerk/nextjs/server'
import { queryOne, isDbConfigured } from '@/lib/db/neon'
import { formatCents } from '@/lib/format'
import { ROUTES, SITE, normalizeWhatsAppNumber } from '@/lib/constants'
import { AutoWhatsappRedirect } from './auto-whatsapp'

export const metadata = { title: 'Pedido enviado · Munay' }
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const orderId = typeof sp.order === 'string' ? sp.order : undefined
  // [F3.0 #3] Eliminado el decodeURIComponent: Next ya decodifica searchParams
  // una vez. Decodificar de nuevo rompía el query string del wa (newlines,
  // emojis, espacios crudos) — la URL de wa.me llega correctamente.
  const waUrl = typeof sp.wa === 'string' ? sp.wa : null
  // [AUDIT] Ticket #XXXX del pedido (transporte desde checkout vía ?ticket=).
  const ticketNumero = typeof sp.ticket === 'string' && /^\d{1,4}$/.test(sp.ticket)
    ? sp.ticket.padStart(4, '0')
    : null

  // [F2.4] Ganador de no-acumulación transportado desde el checkout
  // (&promo=flash&flashPct=25&couponPct=10). createOrder corre server-side
  // en POST; el checkout lo recibe y lo pasa por query params.
  // [FIX Ronda 1] Guardas typeof === 'string' (sp puede ser string[] si el
  // param se repite; Number(string[]) = NaN).
  const promoApplied = typeof sp.promo === 'string' ? sp.promo : undefined
  const flashPct = typeof sp.flashPct === 'string' ? Number(sp.flashPct) : undefined
  const couponPct = typeof sp.couponPct === 'string' ? Number(sp.couponPct) : undefined
  const loyaltyPct = typeof sp.loyaltyPct === 'string' ? Number(sp.loyaltyPct) : undefined

  // Mensaje explícito cuando el flash ganó a un cupón/FID- (no-acumulación).
  const noAccumulationMessage =
    promoApplied === 'flash' && (couponPct || loyaltyPct)
      ? `Este producto ya tenía un descuento especial de Código Flash (${flashPct ?? ''}% OFF), mayor a tu ${couponPct ? `cupón (${couponPct}% OFF)` : `cupón de fidelidad (${loyaltyPct}% OFF)`}. Se aplicó el descuento de Código Flash. Los descuentos no son acumulables en Munay.`
      : null

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
    // [F3.3 #3] Número normalizado a dígitos (wa.me NO acepta '+').
    if (!whatsappUrl && order) {
      const msg = encodeURIComponent(
        `¡Hola! Quiero consultar sobre mi pedido ${orderId.slice(0, 8)}… en Munay. 🙌`
      )
      whatsappUrl = `https://wa.me/${normalizeWhatsAppNumber(SITE.whatsapp)}?text=${msg}`
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

            {/* [AUDIT] Confirmar el ticket al cliente (#XXXX) */}
            {ticketNumero && (
              <div className="w-full rounded-md border border-munay-terracota/20 bg-munay-terracota/5 px-3 py-2 text-sm text-munay-ink/80">
                <p className="flex items-center justify-center gap-2">
                  <Zap className="h-4 w-4 text-munay-terracota" aria-hidden />
                  Tu ticket: <strong className="font-mono text-munay-terracota">#{ticketNumero}</strong>
                </p>
              </div>
            )}

            {/* [F2.4] Mensaje de no-acumulación flash vs cupón (si aplica) */}
            {noAccumulationMessage && (
              <div className="w-full rounded-md border border-munay-terracota/20 bg-munay-terracota/5 p-3 text-left text-xs text-munay-ink/80">
                <p className="flex items-start gap-1.5">
                  <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-munay-terracota" aria-hidden />
                  <span>{noAccumulationMessage}</span>
                </p>
              </div>
            )}

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
