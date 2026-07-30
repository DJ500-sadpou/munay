import Link from 'next/link'
import { MessageCircle, ArrowRight, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ROUTES, SITE } from '@/lib/constants'

export const metadata = { title: 'Pedido en proceso · Munay' }

export default function CheckoutPendingPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="border-munay-whatsapp/15 bg-munay-whatsapp/5 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-munay-whatsapp/10 text-munay-whatsapp">
              <MessageCircle className="h-8 w-8" aria-hidden />
            </span>

            <h1 className="font-display text-3xl font-semibold text-munay-ink">Pedido en proceso</h1>

            <p className="text-munay-ink/60">
              Tu pedido está siendo procesado. Un asesor se pondrá en contacto contigo por
              WhatsApp para coordinar el pago y el envío.
            </p>

            <p className="text-sm text-munay-ink/60 flex items-center gap-2">
              <Mail className="h-4 w-4" aria-hidden />
              <span>Si tienes dudas, escríbenos a {SITE.email}</span>
            </p>

            <div className="mt-4 flex flex-col gap-2 w-full">
              <Button asChild className="bg-munay-whatsapp text-white hover:bg-munay-whatsapp/90">
                <a href={SITE.whatsappLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
                  Contactar por WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link href={ROUTES.catalogo}>
                  Volver al catálogo
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
