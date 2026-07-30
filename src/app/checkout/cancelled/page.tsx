import Link from 'next/link'
import { MessageCircle, ArrowRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ROUTES, SITE } from '@/lib/constants'

export const metadata = { title: 'Pedido no completado · Munay' }

export default function CheckoutCancelledPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="border-munay-terracota/15 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-munay-terracota/10 text-munay-terracota">
              <MessageCircle className="h-8 w-8" aria-hidden />
            </span>

            <h1 className="font-display text-3xl font-semibold text-munay-ink">Pedido no completado</h1>

            <p className="text-munay-ink/60">
              El pedido no se pudo completar. Tu carrito se mantiene intacto
              para que puedas intentar nuevamente por WhatsApp.
            </p>

            <div className="mt-4 flex flex-col gap-2 w-full">
              <Button asChild className="bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
                <Link href={ROUTES.checkout}>
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                  Intentar nuevamente
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-munay-whatsapp text-munay-whatsapp hover:bg-munay-whatsapp/10">
                <a href={SITE.whatsappLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
                  Contactar por WhatsApp
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href={ROUTES.catalogo}>Volver al catálogo</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}