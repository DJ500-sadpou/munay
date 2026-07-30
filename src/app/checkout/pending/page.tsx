import Link from 'next/link'
import { Clock, ArrowRight, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ROUTES, SITE } from '@/lib/constants'

export const metadata = { title: 'Pago en proceso · Munay' }

export default function CheckoutPendingPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="border-munay-cream/60 bg-munay-cream/15 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-munay-cream/40 text-munay-red-600">
              <Clock className="h-8 w-8 animate-pulse" aria-hidden />
            </span>

            <h1 className="font-display text-3xl font-semibold text-munay-ink">Pago en proceso</h1>

            <p className="text-munay-ink/60">
              Tu pago está siendo procesado por la pasarela. Te notificaremos por email
              cuando se confirme (suele tardar unos segundos).
            </p>

            <p className="text-sm text-munay-ink/60 flex items-center gap-2">
              <Mail className="h-4 w-4" aria-hidden />
              <span>Si tienes dudas, escríbenos a {SITE.email}</span>
            </p>

            <div className="mt-4 flex flex-col gap-2 w-full">
              <Button asChild className="bg-munay-red-600 text-white hover:bg-munay-red-800">
                <Link href={ROUTES.home}>
                  Volver al inicio
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
