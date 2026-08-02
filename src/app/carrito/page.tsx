'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, Ticket, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatCents } from '@/lib/format'
import { ROUTES } from '@/lib/constants'
import { useCart } from '@/store/cart'
import { useMounted } from '@/hooks/use-mounted'
import { CouponCheckoutInput, type AppliedCoupon } from '@/components/cart/coupon-checkout-input'
import { readApplied, writeApplied, clearApplied, clearSelected } from '@/lib/coupon-storage'
import { computePromo } from '@/lib/coupon-math'

export default function CarritoPage() {
  // Hidratación segura (Zustand persist lee localStorage en cliente)
  const mounted = useMounted()

  const lines = useCart((s) => s.lines)
  const removeItem = useCart((s) => s.removeItem)
  const updateQty = useCart((s) => s.updateQty)
  const clear = useCart((s) => s.clear)
  const subtotalCents = useCart((s) => s.subtotalCents())
  const pointsToEarn = useCart((s) => s.pointsToEarn())

  // [P1] Cupón de descuento aplicado en el carrito (misma función que el checkout).
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)

  // [P1][FIX Ronda 5] Auto-apply al montar. Orden de precedencia:
  //   1. `?coupon=CODE` (handshake con /cupones "Usar cupón" con returnTo=/carrito)
  //      → validar server-side (1 solo request) → aplicar + persistir.
  //   2. `readApplied()` (cupón YA validado en una visita previa del carrito/
  //      checkout) → aplicar directo SIN re-validar: evita el 429 del rate
  //      limit de /api/coupons/apply (10s/IP) cuando el flujo carrito→checkout
  //      dispararía 2 requests seguidos. El descuento es preview; createOrder
  //      revalida y consume server-side, así que un payload obsoleto (cupón
  //      vencido/agotado) falla al confirmar con un 422 claro, no silencioso.
  const autoAppliedRef = useRef(false)
  useEffect(() => {
    if (autoAppliedRef.current) return
    autoAppliedRef.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('coupon')

    if (code) {
      ;(async () => {
        try {
          const res = await fetch('/api/coupons/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              codigo: code,
              subtotal_cents: useCart.getState().subtotalCents(),
              customer_email: '',
            }),
          })
          const data = await res.json()
          if (data.error_code === 'rate_limited') return
          if (data.ok) {
            setCoupon({ codigo: data.codigo, discount_percent: data.discount_percent })
            writeApplied({ codigo: data.codigo, discount_percent: data.discount_percent })
            // [FIX Ronda 5] Limpiar el "preferido" (selected) tras aplicarlo,
            // igual que hace el checkout: si NO, al quitar el cupón luego, el
            // selected con TTL 1h re-aplicaría el cupón en el próximo checkout
            // (ghost re-application reportado por R1).
            clearSelected()
            // Limpiar el param para que un refresh no re-aplique.
            const url = new URL(window.location.href)
            url.searchParams.delete('coupon')
            window.history.replaceState(null, '', url.toString())
          } else {
            setCouponError(data.error ?? 'No se pudo aplicar el cupón.')
          }
        } catch {
          setCouponError('No se pudo aplicar el cupón. Intenta nuevamente.')
        }
      })()
      return
    }

    const applied = readApplied()
    if (applied) {
      // [FIX Lint] setState síncrono en body de effect (react-hooks/
      // set-state-in-effect) → se difiere al callback del timer (patrón
      // aceptado, igual que en cupones-client.tsx). El cleanup evita setState
      // si el componente se desmonta antes de que corra el timer.
      const id = window.setTimeout(() => {
        setCoupon({ codigo: applied.codigo, discount_percent: applied.discount_percent })
      }, 0)
      return () => window.clearTimeout(id)
    }
  }, [])

  const handleCouponChange = (c: AppliedCoupon | null) => {
    setCoupon(c)
    setCouponError(null)
    // Persistir el "aplicado" para que el checkout lo herede (sin 429).
    writeApplied(c)
    // [FIX Ronda 5] Al QUITAR el cupón, limpiar también el "preferido": si
    // quedara el selected con TTL 1h (escrito por /cupones "Usar cupón"), el
    // próximo checkout lo re-aplicaría solo (ghost re-application, R1).
    if (!c) clearSelected()
  }

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

  // [P1][FIX Ronda 5] Misma aritmética de no-acumulación que el checkout
  // (helper compartido src/lib/coupon-math.ts) para que el total del carrito
  // con cupón coincida EXACTO con el preview del checkout y con createOrder.
  const promo = computePromo({ lines, subtotalCents, coupon })
  const {
    flashSavingsCents,
    flashPct,
    couponDiscountCents,
    flashWins,
    couponWins,
    promoDiscountCents,
    shipping,
    grandTotal,
  } = promo

  return (
    <div className="bg-gradient-to-b from-white via-munay-crema/10 to-white">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink sm:text-4xl">Carrito</h1>
            <p className="mt-2 text-munay-ink/60">
              {lines.length} {lines.length === 1 ? 'pieza' : 'piezas'} · se guarda en tu navegador.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clear()
              // [P1] Al vaciar el carrito se limpia también el cupón aplicado
              // (el descuento sobre un carrito vacío no tiene sentido y no debe
              // "re-aparecer" en el próximo carrito).
              clearApplied()
              setCoupon(null)
            }}
          >
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
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-munay-crema/30"
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
                  {promoDiscountCents > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>
                        Descuento{' '}
                        <code className="ml-1 text-xs">{coupon?.codigo}</code>
                      </span>
                      <span>−{formatCents(promoDiscountCents)}</span>
                    </div>
                  )}
                  {flashSavingsCents > 0 && couponDiscountCents > 0 && (
                    <div className="rounded-md border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-munay-ink/70">
                      {flashWins ? (
                        <>
                          Tu producto ya tiene un descuento especial de Código Flash del {flashPct}%.
                          Tu cupón ofrece {coupon?.discount_percent ?? 0}%. Aplicamos automáticamente
                          el mejor descuento disponible. Los descuentos no son acumulables.
                        </>
                      ) : couponWins ? (
                        <>
                          Aplicamos tu cupón del {coupon?.discount_percent ?? 0}% porque ofrece un
                          mejor descuento que el Código Flash activo.
                        </>
                      ) : (
                        <>
                          Tienes descuentos de Código Flash y de cupón. Aplicamos automáticamente el
                          descuento mayor disponible. Los descuentos no son acumulables.
                        </>
                      )}
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

                {/* [P1] Cupón de descuento — misma función que el checkout */}
                <CouponCheckoutInput
                  subtotalCents={subtotalCents}
                  value={coupon}
                  onChange={handleCouponChange}
                />

                {/* [P1] Explorar mis cupones → /cupones?returnTo=/carrito */}
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`${ROUTES.cupones}?returnTo=${encodeURIComponent(ROUTES.carrito)}`}>
                    <Ticket className="mr-2 h-4 w-4" aria-hidden />
                    Explorar mis cupones
                  </Link>
                </Button>

                {couponError && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                    <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
                    {couponError}
                  </p>
                )}

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
