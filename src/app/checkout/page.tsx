'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Lock, ArrowLeft, ShieldCheck, Loader2, AlertCircle, Gift, Zap, Sparkles, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { formatCents } from '@/lib/format'
import { PAYMENT, ROUTES, POINTS_RULES } from '@/lib/constants'
import { useCart } from '@/store/cart'
import { useMounted } from '@/hooks/use-mounted'
import { CartFlashCodeInput } from '@/components/cart/cart-flash-code-input'
import { PointsRedeemer } from '@/components/cart/points-redeemer'
import { LoyaltyCouponCheckout } from '@/components/cart/loyalty-coupon-checkout'
import { TurnstileWidget } from '@/components/auth/turnstile-widget'

type Step = 'form' | 'processing' | 'redirecting' | 'error'

export default function CheckoutPage() {
  const mounted = useMounted()
  const router = useRouter()

  const lines = useCart((s) => s.lines)
  const subtotalCents = useCart((s) => s.subtotalCents())
  const discountCents = useCart((s) => s.discountCents())
  const totalCents = useCart((s) => s.totalCents())
  const flashCode = useCart((s) => s.flashCode)
  const pointsToEarn = useCart((s) => s.pointsToEarn())
  const clear = useCart((s) => s.clear)

  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)

  // Datos del usuario logueado (para puntos)
  const [userPoints, setUserPoints] = useState<number>(0)
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0)

  // Cupón de fidelidad seleccionado
  const [loyaltyCode, setLoyaltyCode] = useState<string | undefined>()

  // Turnstile token
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  // Datos del formulario
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('Ibarra')
  const [province, setProvince] = useState('Imbabura')

  // Datos de tarjeta (modo demo)
  const [cardNumber, setCardNumber] = useState('4111111111111111')
  const [cardExp, setCardExp] = useState('12/28')
  const [cardCvc, setCardCvc] = useState('123')

  // Cargar saldo de puntos del usuario logueado
  useEffect(() => {
    fetch('/api/user/points')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.ok) {
          setUserPoints(data.balance ?? 0)
          // Pre-llenar email si está logueado
          if (data.email && !email) setEmail(data.email)
        }
      })
      .catch(() => {/* ignorar: usuario no logueado */})
  }, [])

  if (!mounted) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-8 h-64 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  // Fix CRIT-5: declarar ANTES de usar (TDZ fix).
  // Fix secundario: isDemo detecta correctamente por KUSHKI_PUBLIC_KEY, no Supabase.
  const isDemo = !process.env.NEXT_PUBLIC_KUSHKI_PUBLIC_KEY
    || process.env.NEXT_PUBLIC_KUSHKI_PUBLIC_KEY.includes('YOUR-')

    // Recalcular descuento por puntos (debe ir antes de usar adjustedTotalCents).
  const pointsDiscountCents = Math.floor(pointsToRedeem / POINTS_RULES.POINTS_PER_DISCOUNT_DOLLAR) * 100
  // Descuento por cupón de fidelidad (estimación client-side — el cálculo real es server-side)
  const loyaltyDiscountCents = 0 // se calcula server-side al consumir el cupón
  const adjustedTotalCents = Math.max(0, totalCents - pointsDiscountCents - loyaltyDiscountCents)

  const shipping = adjustedTotalCents > 0 ? 200 : 0
  const grandTotal = adjustedTotalCents + shipping

  if (lines.length === 0) {
    return (
      <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-10 text-center">
        <CreditCard className="h-12 w-12 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-semibold">No hay nada que pagar</h1>
        <p className="mt-2 text-muted-foreground">
          Tu carrito está vacío. Agrega piezas antes de proceder al checkout.
        </p>
        <Button asChild className="mt-6">
          <Link href={ROUTES.catalogo}>Ver catálogo</Link>
        </Button>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStep('processing')
    setError(null)

    try {
      // 1. Crear la orden
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },          body: JSON.stringify({
          items: lines.map((l) => ({ product_id: l.id, qty: l.qty })),
          customer_email: email,
          customer_name: name,
          // Fix FLOW3-009: enviar shipping_cents para que la DB refleje el costo real
          shipping: { name, address, city, province, phone, shipping_cents: shipping },
          flash_code: flashCode?.code ?? null,
          loyalty_code: loyaltyCode ?? null,
          points_to_redeem: pointsToRedeem > 0 ? pointsToRedeem : undefined,
          turnstile_token: turnstileToken ?? undefined,
        }),
      })
      const orderData = await orderRes.json()

      if (!orderData.ok) {
        throw new Error(orderData.error ?? 'Error creando orden')
      }

      // 2. Crear el pago
      // En modo demo: no se necesita card_token real.
      // En modo real: aquí se llamaría a Kushki.js para tokenizar y luego
      // se pasaría card_token al endpoint.
      const cardToken = isDemo ? `demo-token-${Date.now()}` : undefined

      const payRes = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderData.order_id,
          card_token: cardToken,
        }),
      })
      const payData = await payRes.json()

      if (!payData.ok) {
        throw new Error(payData.error ?? 'Error procesando pago')
      }

      // 3. Redirigir según resultado
      setStep('redirecting')
      if (payData.redirect_url) {
        // En modo demo, limpiar el carrito antes de redirigir
        clear()
        router.push(payData.redirect_url)
      } else {
        router.push(`/checkout/pending?order=${orderData.order_id}`)
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error inesperado')
      setStep('error')
    }
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href={ROUTES.carrito}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Volver al carrito
        </Link>
      </Button>

      <Badge variant="secondary" className="mb-2">
        Fase 3 · {isDemo ? 'modo demo (sin Kushki configurado)' : `pasarela ${PAYMENT.provider} ${PAYMENT.sandbox ? 'sandbox' : 'producción'}`}
      </Badge>
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Checkout</h1>
      <p className="mt-2 text-muted-foreground">
        Creación de orden en Supabase + integración con pasarela PCI.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Formularios */}
        <div className="space-y-6">
          {/* Datos del comprador */}
          <Card className="border-border/60">
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
                  disabled={step === 'processing'}
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
                  disabled={step === 'processing'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono / WhatsApp</Label>
                <Input
                  id="phone"
                  placeholder="+593 ..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={step === 'processing'}
                />
              </div>
            </CardContent>
          </Card>

          {/* Envío */}
          <Card className="border-border/60">
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
                  disabled={step === 'processing'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ciudad</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={step === 'processing'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Provincia</Label>
                <Input
                  id="province"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  disabled={step === 'processing'}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pago */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" aria-hidden />
                Pago con tarjeta
              </CardTitle>
              <CardDescription>
                {isDemo ? (
                  <>Modo demo: usa cualquier tarjeta de prueba. No se realiza cargo real.</>
                ) : (
                  <>Pago seguro procesado por <strong>{PAYMENT.provider}</strong>. No almacenamos datos de tarjeta.</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="card">Número de tarjeta</Label>
                <Input
                  id="card"
                  inputMode="numeric"
                  placeholder="4111 1111 1111 1111"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/\s/g, ''))}
                  maxLength={19}
                  required
                  disabled={step === 'processing'}
                  className="font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exp">Vencimiento</Label>
                  <Input
                    id="exp"
                    placeholder="MM/YY"
                    value={cardExp}
                    onChange={(e) => setCardExp(e.target.value)}
                    maxLength={5}
                    required
                    disabled={step === 'processing'}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input
                    id="cvc"
                    placeholder="123"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                    maxLength={4}
                    required
                    disabled={step === 'processing'}
                    className="font-mono"
                  />
                </div>
              </div>
              {!isDemo && (
                <p className="text-xs text-muted-foreground">
                  En producción, este formulario será reemplazado por Kushki.js (tokenización embebida).
                  La tarjeta nunca toca nuestro servidor.
                </p>
              )}
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">Error al procesar el pago</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Resumen */}
        <div className="lg:sticky lg:top-20 h-fit space-y-4">
          <Card className="border-border/60">
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
                {discountCents > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>
                      Descuento flash {flashCode && <code className="ml-1 text-xs">{flashCode.code}</code>}
                    </span>
                    <span>−{formatCents(discountCents)}</span>
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
                {loyaltyDiscountCents > 0 && (
                  <div className="flex justify-between text-accent">
                    <span className="flex items-center gap-1">
                      <Gift className="h-3 w-3" aria-hidden />
                      Cupón fidelidad
                    </span>
                    <span>−{formatCents(loyaltyDiscountCents)}</span>
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

              <CartFlashCodeInput />

              {/* Cupón de fidelidad (solo si hay sesión y cupones activos) */}
              <LoyaltyCouponCheckout
                subtotalCents={subtotalCents}
                loyaltyCode={loyaltyCode}
                onChange={setLoyaltyCode}
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
                className="w-full"
                disabled={step === 'processing' || step === 'redirecting'}
              >
                {step === 'processing' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Procesando…
                  </>
                ) : step === 'redirecting' ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                    Redirigiendo…
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" aria-hidden />
                    Pagar {formatCents(grandTotal)}
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                Cifrado TLS · sin almacenamiento de tarjeta
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  )
}
