'use client'

import Link from 'next/link'
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { formatCents } from '@/lib/format'
import { ROUTES } from '@/lib/constants'
import { useCart } from '@/store/cart'
import { CartFlashCodeInput } from '@/components/cart/cart-flash-code-input'
import { useMounted } from '@/hooks/use-mounted'

export default function CarritoPage() {
  // Hidratación segura (Zustand persist lee localStorage en cliente)
  const mounted = useMounted()

  const lines = useCart((s) => s.lines)
  const removeItem = useCart((s) => s.removeItem)
  const updateQty = useCart((s) => s.updateQty)
  const clear = useCart((s) => s.clear)
  const subtotalCents = useCart((s) => s.subtotalCents())
  const discountCents = useCart((s) => s.discountCents())
  const totalCents = useCart((s) => s.totalCents())
  const pointsToEarn = useCart((s) => s.pointsToEarn())

  // Evitar hidration mismatch
  if (!mounted) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-8 h-64 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-10 text-center">
        <ShoppingBag className="h-12 w-12 text-munay-ink/30" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-semibold text-munay-ink">Tu carrito está vacío</h1>
        <p className="mt-2 text-munay-ink/60">
          Explora el catálogo y agrega piezas que resuenen contigo.
        </p>
        <Button asChild className="mt-6 bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
          <Link href={ROUTES.catalogo}>Ver catálogo</Link>
        </Button>
      </div>
    )
  }

  const shipping = subtotalCents > 0 ? 200 : 0
  const grandTotal = totalCents + shipping

  return (
    <div className="bg-gradient-to-b from-white via-munay-cream/10 to-white">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink sm:text-4xl">Carrito</h1>
            <p className="mt-2 text-munay-ink/60">
              {lines.length} {lines.length === 1 ? 'pieza' : 'piezas'} · se guarda en tu navegador.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={clear}>
            <Trash2 className="mr-1 h-4 w-4" aria-hidden />
            Vaciar
          </Button>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {lines.map((line) => (
              <Card key={line.id} className="border-black/5 shadow-sm">
                <CardContent className="flex items-center gap-4 p-4">
                  <Link
                    href={ROUTES.producto(line.slug)}
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-munay-cream/30"
                    aria-label={line.title}
                  >
                    <ShoppingBag className="h-5 w-5 text-munay-ink/40" aria-hidden />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={ROUTES.producto(line.slug)}
                      className="line-clamp-2 text-sm font-medium text-munay-ink hover:text-munay-terracota transition-colors"
                    >
                      {line.title}
                    </Link>
                    <p className="mt-1 text-sm text-munay-ink/60">
                      {formatCents(line.unit_price_cents)} c/u
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQty(line.id, line.qty - 1)}
                      aria-label="Quitar uno"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{line.qty}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQty(line.id, line.qty + 1)}
                      aria-label="Agregar uno"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="hidden sm:block w-24 text-right text-sm font-semibold">
                    {formatCents(line.unit_price_cents * line.qty)}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-munay-ink/40 hover:text-destructive"
                    onClick={() => removeItem(line.id)}
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="lg:sticky lg:top-20 h-fit space-y-4">
            <Card className="border-black/5 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-munay-ink/60">Subtotal</span>
                    <span>{formatCents(subtotalCents)}</span>
                  </div>
                  {discountCents > 0 && (
                    <div className="flex justify-between text-munay-terracota">
                      <span>Descuento flash</span>
                      <span>−{formatCents(discountCents)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-munay-ink/60">Envío (estimado)</span>
                    <span>{formatCents(shipping)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-munay-ink/60">Puntos a ganar</span>
                    <span className="text-munay-terracota">{pointsToEarn} pts</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatCents(grandTotal)}</span>
                </div>

                <CartFlashCodeInput />

                <Button asChild size="lg" className="w-full bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
                  <Link href={ROUTES.checkout}>
                    Continuar al checkout
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                </Button>

                <p className="text-center text-xs text-munay-ink/50">
                  Guest checkout disponible · login opcional para historial y puntos
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
