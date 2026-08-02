'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, ArrowLeft, Loader2, AlertCircle, Sparkles, CheckCircle2, ShoppingBag, Ticket } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { formatCents } from '@/lib/format'
import { ROUTES, POINTS_RULES } from '@/lib/constants'
import { readSelected, clearSelected, readApplied, writeApplied } from '@/lib/coupon-storage'
import { computePromo } from '@/lib/coupon-math'
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

  // [P0b] Guard anti doble-submit: además del `disabled` por estado, un ref
  // corta el 2º submit inmediato (2 clics rápidos → 2 requests → el 2º recibía
  // 429 aunque el 1º ya hubiera creado el ticket).
  const submittingRef = useRef(false)
  // [P0b] Countdown real del 429 (Retry-After) para no dejar al usuario con
  // un mensaje estático.
  const [retryIn, setRetryIn] = useState(0)

  // Datos del usuario logueado (para puntos)
  const [userPoints, setUserPoints] = useState<number>(0)
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0)

  // Cupón de descuento aplicado (tabla coupons)
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)
  // [P2c] Error al auto-aplicar un cupón venido de /cupones (?coupon=)
  const [couponError, setCouponError] = useState<string | null>(null)

  // Cupón de fidelidad seleccionado
  const [loyaltyCode, setLoyaltyCode] = useState<string | undefined>()
  const [loyaltyPercent, setLoyaltyPercent] = useState<number | undefined>()

  // Turnstile token
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  // Datos del formulario
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  // [P2] Prefijo +593 precargado para ahorrar tipeo; sigue siendo un input
  // libre: el cliente puede borrarlo completo (campo opcional) o cambiarlo.
  const [phone, setPhone] = useState('+593 ')
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

  // [FIX Ronda 2] Guard con useRef: en dev, StrictMode monta/desmonta/remonta
  // el component y RE-EJECUTA los effects (el ref persiste en el mismo fiber).
  // Sin este guard, el auto-apply haría 2 fetch: el 1º exitoso se descarta
  // por `cancelled` y el 2º cae en el rate limit (429) → cupón nunca aplicado
  // en dev. Con el ref, el doble-fetch se previene de raíz.
  const autoAppliedRef = useRef(false)
  // [P2c] Auto-aplicar cupón recibido vía ?coupon=CODE (handshake con la
  // página /cupones "Usar cupón"). Se lee de window.location en vez de
  // useSearchParams (que en Next 15 exige Suspense). Se revalida server-side
  // con el subtotal REAL del carrito — el monto mínimo SÍ aplica aquí.
  useEffect(() => {
    // [FIX Ronda 2] Guard con useRef: en dev, StrictMode monta/desmonta/remonta
    // y RE-EJECUTA los effects (el ref persiste en el mismo fiber). El guard
    // garantiza UN SOLO fetch de auto-apply — sin él, el 2º fetch caía en el
    // rate limit (429) y el cupón nunca se aplicaba en dev.
    // [FIX Ronda 3] Se eliminó el flag `cancelled`: su cleanup corría ENTRE
    // los dos mounts simulados de StrictMode (antes de que el fetch resolviera)
    // y descartaba el resultado del único fetch. Con el ref guard basta:
    // React 18+ trata setState tras desmontar como no-op seguro.
    if (autoAppliedRef.current) return
    autoAppliedRef.current = true
    // [FIX Ronda 3] Handshake completo: si no viene ?coupon= en la URL, usar
    // el cupón "preferido" guardado en localStorage (munay.cupones.selected).
    // Cubre el flujo "Usar cupón" desde /cupones con carrito vacío → catálogo
    // → checkout: el param se pierde al pasar por el catálogo, pero el selected
    // persiste y el checkout lo aplica al llegar.
    const params = new URLSearchParams(window.location.search)
    const paramCode = params.get('coupon')
    // [P1][FIX Ronda 5] Tercera fuente: el cupón YA VALIDADO en el carrito
    // (munay.cupones.applied). Se revalida server-side con tolerancia a 429:
    // si el rate limit de /api/coupons/apply (10s/IP) responde 429 por el
    // request del carrito, se usa el payload almacenado sin re-validar (el
    // descuento es preview; createOrder revalida y consume server-side).
    const applied = readApplied()
    // Precedencia: ?coupon= (explícito) > applied (carrito/checkout) > selected (TTL).
    let code: string | null = paramCode ?? applied?.codigo ?? null
    if (!code) {
      // [FIX Ronda 5] El preferido (JSON { code, at } con TTL de 1h, limpieza
      // de obsoletos/corruptos/formato viejo) se lee desde el módulo
      // compartido src/lib/coupon-storage.ts — la regla TTL vive en UN solo
      // lugar (checkout y /cupones no pueden divergir).
      code = readSelected()
    }
    if (!code) return
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
        // Red de seguridad: si llega un 429 (p.ej. el usuario acaba de aplicar
        // el cupón en el carrito y el checkout revalida dentro de la ventana),
        // NO mostrar un mensaje engañoso: si venía un "aplicado" del carrito,
        // se muestra tal cual (preview; createOrder revalida en el submit).
        if (data.error_code === 'rate_limited') {
          if (applied && !paramCode) {
            setCoupon({ codigo: applied.codigo, discount_percent: applied.discount_percent })
          }
          return
        }
        if (data.ok) {
          const payload = { codigo: data.codigo, discount_percent: data.discount_percent }
          setCoupon(payload)
          // [P1] Sincronizar el "aplicado" para que el carrito lo herede
          // también (loop carrito <-> checkout cerrado en ambos sentidos).
          writeApplied(payload)
          // [FIX Ronda 1] Limpiar el param de la URL para que un refresh NO
          // re-aplique el cupón aunque el usuario lo haya quitado después.
          if (paramCode) {
            const url = new URL(window.location.href)
            url.searchParams.delete('coupon')
            window.history.replaceState(null, '', url.toString())
          }
          // [FIX Ronda 3] Limpiar el "preferido" de localStorage tras aplicarlo
          // (ya está aplicado; no debe re-aplicarse en futuros checkouts).
          // [FIX Ronda 5] Via módulo compartido (src/lib/coupon-storage.ts).
          clearSelected()
        } else {
          // [P1] El cupón del carrito ya no es válido (venció/agotó/monto
          // mínimo): limpiar el "aplicado" y mostrar el error real.
          if (applied) writeApplied(null)
          setCouponError(data.error ?? 'No se pudo aplicar el cupón.')
        }
      } catch {
        // Error de conexión: si venía un "aplicado" del carrito, mostrarlo
        // (preview; createOrder revalida al confirmar).
        if (applied && !paramCode) {
          setCoupon({ codigo: applied.codigo, discount_percent: applied.discount_percent })
          return
        }
        setCouponError('No se pudo aplicar el cupón. Intenta nuevamente.')
      }
    })()
  }, [])

  // [P0b] Countdown del 429: decrementa cada segundo mientras haya cooldown.
  // IMPORTANTE: este hook vive ANTES de los early returns (rules-of-hooks).
  // FIX Ronda 2 + lint: la limpieza del mensaje obsoleto vive en el CALLBACK
  // del intervalo (setState en callback async = permitido por
  // react-hooks/set-state-in-effect; un setState síncrono en el body del
  // effect dispararía el error de cascading renders). Al llegar retryIn a 1,
  // el siguiente tick limpia el mensaje "Demasiadas solicitudes" (sin texto
  // contradictorio con el botón ya habilitado) y pone el countdown en 0.
  useEffect(() => {
    if (retryIn <= 0) return
    const id = setInterval(() => {
      if (retryIn === 1) {
        setError((prev) =>
          prev?.startsWith('Demasiadas solicitudes') ? null : prev
        )
      }
      setRetryIn((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [retryIn])

  if (!mounted) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-8 h-64 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  const pointsDiscountCents = Math.floor(pointsToRedeem / POINTS_RULES.POINTS_PER_DISCOUNT_DOLLAR) * 100

  // [P1][FIX Ronda 5] Aritmética de no-acumulación compartida con el carrito
  // (src/lib/coupon-math.ts): el ganador (flash/cupón/FID-) y el total se
  // calculan en UN solo lugar para que el preview del carrito y del checkout
  // coincidan EXACTO entre sí y con createOrder (que cobra server-side).
  const {
    flashSavingsCents,
    flashPct,
    couponDiscountCents,
    loyaltyDiscountCents,
    flashWins,
    couponWins,
    promoDiscountCents,
    shipping,
    grandTotal,
  } = computePromo({ lines, subtotalCents, coupon, loyaltyPercent, pointsDiscountCents })

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
    // [P0b] Doble-submit guard: ignora clics mientras hay un request en vuelo.
    if (submittingRef.current) return
    // [AUDIT A2] Gate de Turnstile: no enviar sin token anti-bot (evita el
    // error opaco de requireTurnstile cuando el widget aún no verificó).
    if (!turnstileToken) {
      setError('Completa la verificación anti-bot antes de continuar.')
      setStep('error')
      return
    }
    submittingRef.current = true
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
        // [P0b] 429 real: mostrar countdown con Retry-After del servidor.
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get('Retry-After') ?? 0)
          const seconds = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.ceil(retryAfter)
            : 15
          setRetryIn(seconds)
          throw new Error(`Demasiadas solicitudes. Intenta en ${seconds} segundos.`)
        }
        throw new Error(data.error ?? 'Error al procesar el pedido')
      }

      // Limpiar carrito y redirigir a WhatsApp
      setStep('redirecting')
      clear()
      // [P1] El cupón ya se consumió dentro de createOrder: limpiar el
      // "aplicado" para que no re-aparezca en un futuro carrito/checkout.
      writeApplied(null)

      // [F2.4] Transportar el ganador de no-acumulación a la success page por
      // query params (createOrder corre server-side en POST; el checkout es
      // cliente y no conoce el resultado): &promo=flash&flashPct=25&couponPct=10
      const promoParams = new URLSearchParams()
      if (data.promo_applied && data.promo_applied !== 'none') {
        promoParams.set('promo', data.promo_applied)
      }
      if (typeof data.flash_discount_percent === 'number' && data.flash_discount_percent > 0) {
        promoParams.set('flashPct', String(data.flash_discount_percent))
      }
      if (typeof data.coupon_discount_percent === 'number' && data.coupon_discount_percent > 0) {
        promoParams.set('couponPct', String(data.coupon_discount_percent))
      }
      if (typeof data.loyalty_discount_percent === 'number' && data.loyalty_discount_percent > 0) {
        promoParams.set('loyaltyPct', String(data.loyalty_discount_percent))
      }
      const promoQS = promoParams.toString()

      // Redirigir a WhatsApp (usar location.href en vez de window.open para evitar popup blockers)
      if (data.whatsapp_url) {
        // Primero redirigir a success page, que tendrá el botón para abrir WhatsApp
        // [AUDIT] Pasar también el ticket_numero para que la success page lo
        // muestre al cliente (#XXXX — refuerza el flujo de ticket).
        const ticketQS = data.ticket_numero != null
          ? `&ticket=${String(data.ticket_numero).padStart(4, '0')}`
          : ''
        const base = `/checkout/success?order=${data.order_id}&wa=${encodeURIComponent(data.whatsapp_url)}${ticketQS}`
        router.push(promoQS ? `${base}&${promoQS}` : base)
      } else {
        const base = `/checkout/success?order=${data.order_id}`
        router.push(promoQS ? `${base}&${promoQS}` : base)
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error inesperado')
      setStep('error')
    } finally {
      submittingRef.current = false
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
                  type="tel"
                  inputMode="tel"
                  placeholder="9X XXX XXXX"
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
                {/* [P2c] No-acumulación visible: cuando coexisten descuento
                    Flash y cupón, se explica quién gana ANTES de confirmar.
                    [FIX Ronda 1] Hay 3 competidores (flash / cupón / fidelidad):
                    la rama "gana el cupón" solo aplica cuando couponWins;
                    si gana fidelidad se muestra un mensaje genérico. */}
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
                onChange={(c) => {
                  // [FIX Ronda 1] Limpiar couponError también al aplicar un
                  // cupón manual (antes solo se limpiaba al quitar el cupón).
                  setCoupon(c)
                  setCouponError(null)
                  // [P1] Sincronizar el "aplicado" (null → borra) para que el
                  // carrito lo herede / lo pierda al quitar aquí.
                  writeApplied(c)
                }}
              />

              {/* [P2c] Botón secundario "Explorar mis cupones" → /cupones?returnTo=/checkout */}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`${ROUTES.cupones}?returnTo=${encodeURIComponent(ROUTES.checkout)}`}>
                  <Ticket className="mr-2 h-4 w-4" aria-hidden />
                  Explorar mis cupones
                </Link>
              </Button>

              {/* [P2c] Error al auto-aplicar el cupón venido de /cupones */}
              {couponError && (
                <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                  <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
                  {couponError}
                </p>
              )}

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
              <TurnstileWidget
                onVerify={(token) => {
                  setTurnstileToken(token)
                  // [AUDIT] Limpiar el error del gate cuando el token finalmente
                  // llega (el usuario completó el challenge) para no mostrar un
                  // mensaje de error obsoleto.
                  if (token) setError((prev) => (prev === 'Completa la verificación anti-bot antes de continuar.' ? null : prev))
                }}
                className="min-h-[65px]"
              />
              {!turnstileToken && step !== 'sending' && (
                <p className="flex items-center gap-1.5 text-xs text-munay-ink/50">
                  <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
                  Completa la verificación anti-bot para habilitar el envío.
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full bg-munay-whatsapp text-white hover:bg-munay-whatsapp/90"
                disabled={step === 'sending' || step === 'redirecting' || retryIn > 0 || !turnstileToken}
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
                ) : retryIn > 0 ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Reintenta en {retryIn}s
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
