'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Copy, Ticket } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCents } from '@/lib/format'
import { ROUTES } from '@/lib/constants'
import type { Coupon } from '@/lib/queries/coupons'

interface Props {
  coupons: Coupon[]
}

/** Countdown hasta fecha_fin (FIX #14 — conserva la urgencia). */
function useCountdown(endsAt: string) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const diff = Math.max(0, new Date(endsAt).getTime() - now)
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  const seconds = Math.floor((diff % 60_000) / 1000)
  return { days, hours, minutes, seconds, expired: diff <= 0 }
}

/**
 * [FIX Ronda 1] Card individual de cupón. Extraída como componente propio
 * para que `useCountdown` (hook) se llame SIEMPRE en el top-level y NUNCA
 * dentro de un `.map()` (Rules of Hooks).
 */
function CouponCard({ coupon }: { coupon: Coupon }) {
  const countdown = useCountdown(coupon.fecha_fin)
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000)
    } catch {
      setCopied(null)
    }
  }

  const minLabel =
    coupon.monto_minimo_compra > 0
      ? `Desde ${formatCents(coupon.monto_minimo_compra)}`
      : 'Sin mínimo de compra'

  return (
    <li className="flex flex-col rounded-xl border border-black/5 bg-munay-crema/15 p-4 text-center">
      {/* [F1.3] Badge "Primera compra" para cupones de ese tipo (solo visibles
          para usuarios sin compras pagadas — getActiveCouponsForUser). */}
      {coupon.tipo === 'primera_compra' && (
        <Badge className="mx-auto mb-1.5 justify-center bg-munay-terracota/10 text-[10px] font-bold text-munay-terracota-quemado">
          Primera compra
        </Badge>
      )}
      <p className="font-mono text-sm font-bold tracking-tight text-munay-terracota">
        {coupon.codigo}
      </p>
      <p className="mt-2 text-xl font-extrabold text-munay-ink">
        {coupon.porcentaje_descuento}% OFF
      </p>
      <p className="text-[11px] text-munay-ink/60">{minLabel}</p>

      {/* Countdown (FIX #14) */}
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-munay-terracota">
        {countdown.expired
          ? 'Expirado'
          : countdown.days > 0
          ? `Vence en ${countdown.days}d ${countdown.hours}h`
          : `Vence en ${String(countdown.hours).padStart(2, '0')}:${String(
              countdown.minutes
            ).padStart(2, '0')}:${String(countdown.seconds).padStart(2, '0')}`}
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => copy(coupon.codigo)}
        aria-live="polite"
        className="mt-3 rounded-lg border-munay-terracota/40 bg-white text-xs font-semibold text-munay-terracota hover:bg-munay-terracota/5 hover:text-munay-terracota-quemado"
      >
        {copied === coupon.codigo ? (
          <>
            <Check className="h-3.5 w-3.5" aria-hidden />
            ¡Copiado!
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copiar código
          </>
        )}
      </Button>
    </li>
  )
}

/**
 * MunayCouponCards — Cupones de descuento activos (tabla `coupons`).
 *
 * [F3] Reemplaza a MunayLiveCodes: los códigos flash ya NO se listan aquí
 * (son mecanismo de descubrimiento vía la búsqueda del catálogo). Aquí se
 * muestran los cupones aplicables en el checkout, con countdown de fecha_fin.
 */
export function MunayCouponCards({ coupons }: Props) {
  const hasCoupons = coupons.length > 0

  return (
    <div className="flex h-full flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-wide text-munay-ink">
          Cupones y ofertas
          {hasCoupons && (
            <Badge className="rounded-full bg-munay-terracota-quemado px-2 text-[10px] font-bold text-white">
              <span
                className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white"
                aria-hidden
              />
              LIVE
            </Badge>
          )}
        </h2>
        <Link
          href={ROUTES.checkout}
          className="flex items-center gap-1 text-xs font-semibold text-munay-terracota transition-colors hover:text-munay-terracota-quemado"
        >
          Aplicar en el checkout
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <p className="mt-1 text-sm text-munay-ink/60">
        Cupones de descuento válidos para toda la tienda
      </p>

      {!hasCoupons ? (
        <div className="mt-5 flex flex-1 items-center justify-center rounded-xl border border-dashed border-black/10 bg-munay-crema/10 py-8 text-center">
          <div>
            <Ticket className="mx-auto h-6 w-6 text-munay-ink/30" aria-hidden />
            <p className="mt-2 text-sm text-munay-ink/50">
              No hay cupones activos ahora.
            </p>
            <p className="text-xs text-munay-ink/40">
              ¡Vuelve pronto para nuevas ofertas!
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-5 grid flex-1 gap-3 sm:grid-cols-3">
          {coupons.map((c) => (
            <CouponCard key={c.codigo} coupon={c} />
          ))}
        </ul>
      )}
    </div>
  )
}
