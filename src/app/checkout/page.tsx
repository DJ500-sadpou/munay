'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, ArrowLeft, Loader2, AlertCircle, Sparkles, CheckCircle2, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { formatCents } from '@/lib/format'
import { ROUTES, POINTS_RULES } from '@/lib/constants'
import { useCart } from '@/store/cart'
import { useMounted } from '@/hooks/use-mounted'
import { CouponCheckoutInput, type AppliedCoupon } from '@/components/cart/coupon-checkout-input'
import { PointsRedeemer } from '@/components/cart/points-redeemer'
import { LoyaltyCouponCheckout } from '@/components/cart/loyalty-coupon-checkout'
import { TurnstileWidget } from '@/components/auth/turnstile-widget'

type Step = 'form' | 'sending' | 'redirecting' | 'error'

export default function CheckoutPage() {
  const mounted = useMounted()
  const router = useRouter()

  const lines = useCart((s) => s.lines)
  const subtotalCents = useCart((s) => s.subtotalCents())
  const clear = useCart((s) => s.clear)

  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)

  // Datos del usuario logueado (para puntos)
  const [userPoints, setUserPoints] = useState<number>(0)
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0)

  // Cupón de descuento aplicado (tabla coupons)
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)

  // Cupón de fidelidad seleccionado
  const [loyaltyCode, setLoyaltyCode] = useState<string | undefined>()
  const [loyaltyPercent, setLoyaltyPercent] = useState<number | undefined>()

  // Turnstile token
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  // Datos del formulario
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('Ibarra')
  const [province, setProvince] = useState('Imbabura')

  // Cargar saldo de puntos del usuario logueado
  useEffect(() => {
    fetch('/api/user/points')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.ok) {
          setUserPoints(data.balance ?? 0)
          if (data.email && !email) setEmail(data.email)
        }
      })
      .catch(() => {/* ignorar: usuario no logueado */})
  }, [])

  if (!mounted) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-8 h-64 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  const pointsDiscountCents = Math.floor(pointsToRedeem / POINTS_RULES.POINTS_PER_DISCOUNT_DOLLAR) * 100
  // Descuento del cupón (validado contra /api/coupons/apply; el consumo real
  // ocurre en createOrder).
  const couponDiscountCents = coupon
    ? Math.min(subtotalCents, Math.round(subtotalCents * (coupon.discount_percent / 100)))
    : 0
  // Descuento del cupón de fidelidad (FID-) si hay uno seleccionado.
  const loyaltyDiscountCents = loyaltyPercent
    ? Math.min(subtotalCents, Math.round(subtotalCents * (loyaltyPercent / 100)))
    : 0
  // [FIX Ronda 1] No acumulación: el servidor aplica max(loyalty, coupon).
  // El resumen muestra el mismo descuento que aplicará createOrder.
  const promoDiscountCents = Math.max(couponDiscountCents, loyaltyDiscountCents)
  const adjustedTotalCents = Math.max(0, subtotalCents - promoDiscountCents - pointsDiscountCents)

  const shipping = adjustedTotalCents > 0 ? 200 : 0
  const grandTotal = adjustedTotalCents + shipping

  if (lines.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-10 text-center">
        <ShoppingBag className="h-12 w-12 text-munay-ink/30" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-semibold text-munay-ink">Tu carrito está vacío</h1>
        <p className="mt-2 text-munay-ink/60">
          Agrega piezas al carrito antes de continuar.
        </p>
        <Button asChild className="mt-6 bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
          <Link href={ROUTES.catalogo}>Ver catálogo</Link>
        </Button>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStep('sending')
    setError(null)

    try {
      // Enviar pedido: crear orden + ticket + obtener URL de WhatsApp
      const res = await fetch('/api/checkout/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((l) => ({
            product_id: l.id,
            qty: l.qty,
            title: l.title,
            // [BLOQUE B] flash_code por línea para aplicar precio_especial_cents
            // de forma autoritativa en createOrder.
            flash_code: l.flash_code ?? null,
          })),
          customer_email: email,
          customer_name: name,
          phone,
          address,
          city,
          province,
          shipping_cents: shipping,
          coupon_code: coupon?.codigo ?? null,
          loyalty_code: loyaltyCode ?? null,
          points_to_redeem: pointsToRedeem > 0 ? pointsToRedeem : undefined,
          turnstile_token: turnstileToken ?? undefined,
        }),
      })
      const data = await res.json()

      if (!data.ok) {
        throw new Error(data.error ?? 'Error al procesar el pedido')
      }

      // Limpiar carrito y redirigir a WhatsApp
      setStep('redirecting')
      clear()

      // Redirigir a WhatsApp (usar location.href en vez de window.open para evitar popup blockers)
      if (data.whatsapp_url) {
        // Primero redirigir a success page, que tendrá el botón para abrir WhatsApp
        router.push(`/checkout/success?order=${data.order_id}&wa=${encodeURIComponent(data.whatsapp_url)}`)
      } else {
        router.push(`/checkout/success?order=${data.order_id}`)
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error inesperado')
      setStep('error')
    }
  }

  return (
    <div className="bg-gradient-to-b from-white via-munay-crema/10 to-white">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link href={ROUTES.carrito}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Volver al carrito
          </Link>
        </Button>

        <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink sm:text-4xl">Checkout</h1>
        <p className="mt-2 text-munay-ink/60">
          Te contactaremos por WhatsApp para coordinar el pago y el envío.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Card className="border-black/5 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Datos del comprador</CardTitle>
              <CardDescription>
                Como invitado. Opcional: inicia sesión para acumular puntos.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={step === 'sending'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={step === 'sending'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono / WhatsApp</Label>
                <Input
                  id="phone"
                  placeholder="+593 ..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={step === 'sending'}
                />
              </div>
            </CardContent>
          </Card>

          {/* Envío */}
          <Card className="border-black/5 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Dirección de envío</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="addr">Dirección *</Label>
                <Input
                  id="addr"
                  placeholder="Calle, número, referencia"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  disabled={step === 'sending'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ciudad</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={step === 'sending'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Provincia</Label>
                <Input
                  id="province"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  disabled={step === 'sending'}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pago vía WhatsApp */}
          <Card className="border-munay-whatsapp/15 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-munay-whatsapp" aria-hidden />
                Pago por WhatsApp
              </CardTitle>
              <CardDescription>
                No aceptamos pagos en línea. Un asesor se pondrá en contacto contigo por
                WhatsApp para coordinar el método de pago (transferencia, depósito, efectivo).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-munay-whatsapp/5 border border-munay-whatsapp/10 p-4 text-sm">
                <p className="font-medium text-munay-ink">¿Cómo funciona?</p>
                <ol className="mt-2 space-y-1.5 text-munay-ink/70 list-decimal list-inside">
                  <li>Completa tus datos y envía el pedido</li>
                  <li>Te redirigiremos a WhatsApp con un resumen de tu orden</li>
                  <li>Un asesor te confirmará el total exacto y el método de pago</li>
                  <li>Una vez confirmado el pago, procesaremos tu envío</li>
                </ol>
              </div>
              <div className="flex items-center gap-2 text-xs text-munay-ink/50">
                <CheckCircle2 className="h-3 w-3 text-munay-whatsapp" aria-hidden />
                Sin datos bancarios en el sitio · Pago seguro por WhatsApp
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">Error al enviar el pedido</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>          {/* Resumen */}
        <div className="lg:sticky lg:top-20 h-fit space-y-4">
          <Card className="border-black/5 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Tu orden</CardTitle>
              <CardDescription>{lines.length} {lines.length === 1 ? 'pieza' : 'piezas'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {lines.map((line) => (
                  <li key={line.id} className="flex justify-between gap-2">
                    <span className="line-clamp-2 flex-1 text-muted-foreground">
                      {line.title} <span className="text-xs">× {line.qty}</span>
                    </span>
                    <span className="font-medium">{formatCents(line.unit_price_cents * line.qty)}</span>
                  </li>
                ))}
              </ul>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCents(subtotalCents)}</span>
                </div>
                {promoDiscountCents > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>
                      Descuento{' '}
                      {couponDiscountCents >= loyaltyDiscountCents && coupon ? (
                        <code className="ml-1 text-xs">{coupon.codigo}</code>
                      ) : (
                        <span className="ml-1 text-xs">fidelidad</span>
                      )}
                    </span>
                    <span>−{formatCents(promoDiscountCents)}</span>
                  </div>
                )}
                {pointsDiscountCents > 0 && (
                  <div className="flex justify-between text-primary">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" aria-hidden />
                      Puntos ({pointsToRedeem} pts)
                    </span>
                    <span>−{formatCents(pointsDiscountCents)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Envío</span>
                  <span>{formatCents(shipping)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Puntos a ganar</span>
                  <span className="text-primary">{Math.floor(grandTotal / 100)} pts</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{formatCents(grandTotal)}</span>
              </div>

              <CouponCheckoutInput
                subtotalCents={subtotalCents}
                customerEmail={email}
                value={coupon}
                onChange={setCoupon}
              />

              {/* Cupón de fidelidad (solo si hay sesión y cupones activos) */}
              <LoyaltyCouponCheckout
                subtotalCents={subtotalCents}
                loyaltyCode={loyaltyCode}
                onChange={(code, percent) => {
                  setLoyaltyCode(code)
                  setLoyaltyPercent(code ? percent : undefined)
                }}
              />

              {/* Redención de puntos (solo si hay sesión y saldo) */}
              {userPoints > 0 && (
                <PointsRedeemer
                  balance={userPoints}
                  subtotalCents={subtotalCents}
                  selected={pointsToRedeem}
                  onChange={setPointsToRedeem}
                />
              )}

              {/* Verificación anti-bot */}
              <TurnstileWidget onVerify={setTurnstileToken} className="min-h-[65px]" />

              <Button
                type="submit"
                size="lg"
                className="w-full bg-munay-whatsapp text-white hover:bg-munay-whatsapp/90"
                disabled={step === 'sending' || step === 'redirecting'}
              >
                {step === 'sending' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Enviando pedido…
                  </>
                ) : step === 'redirecting' ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                    Redirigiendo a WhatsApp…
                  </>
                ) : (
                  <>
                    <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
                    Enviar pedido por WhatsApp
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-munay-ink/50">
                <CheckCircle2 className="h-3 w-3 text-munay-whatsapp" aria-hidden />
                Pago coordinado por WhatsApp · sin tarjeta
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
    </div>
  )
}
