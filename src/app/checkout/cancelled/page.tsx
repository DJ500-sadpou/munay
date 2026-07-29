import Link from 'next/link'
import { XCircle, ArrowRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ROUTES } from '@/lib/constants'

export const metadata = { title: 'Pago cancelado' }

export default function CheckoutCancelledPage() {
  return (
    <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <XCircle className="h-8 w-8" aria-hidden />
            </span>

            <h1 className="font-display text-3xl font-semibold">Pago no completado</h1>

            <p className="text-muted-foreground">
              El pago fue cancelado o no se pudo procesar. Tu carrito se mantiene intacto
              para que puedas intentar nuevamente.
            </p>

            <div className="mt-4 flex flex-col gap-2 w-full">
              <Button asChild>
                <Link href={ROUTES.checkout}>
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                  Intentar nuevamente
                </Link>
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
