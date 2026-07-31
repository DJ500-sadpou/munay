'use client'

import { useEffect, useState, useActionState } from 'react'
import Link from 'next/link'
import { Calendar, Clock, Sparkles, ChevronRight, ShoppingBag, CheckCircle, Users, Percent } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { WeekBuyCampaign } from '@/types/week-buy'

interface WeekBuyBannerProps {
  campaign: WeekBuyCampaign | null
  userId?: string | null
  userEmail?: string | null
  hasCommitted?: boolean
}

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

/**
 * WeekBuyBanner — Banner de campaña semanal.
 *
 * ESTADO A (sin campaña activa): Banner turquesa tenue informativo
 * ESTADO B (campaña activa): Banner cacao con countdown + progreso + botón compromiso
 */
export function WeekBuyBanner({ campaign, userId, userEmail, hasCommitted }: WeekBuyBannerProps) {
  // ── Estado A: Sin campaña activa ──────────────────────
  if (!campaign) {
    return (
      <section aria-label="Quincena Munay — próximamente">
        <Card className="overflow-hidden border-munay-turquesa/20 bg-gradient-to-br from-munay-turquesa/[0.04] to-munay-turquesa/[0.08] shadow-sm">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-munay-turquesa/10">
                <Sparkles className="h-6 w-6 text-munay-turquesa" aria-hidden />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-munay-ink">
                  Quincena Munay — próximamente
                </h3>
                <p className="mt-1 text-sm text-munay-ink/60">
                  Pronto tendremos una nueva categoría en oferta quincenal con descuento progresivo.
                  ¡Estate atento!
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="shrink-0 rounded-xl">
              <Link href="/flash">
                Ver códigos activos
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  // ── Estado B: Campaña activa ──────────────────────────
  return (
    <WeekBuyBannerActive
      campaign={campaign}
      userId={userId}
      userEmail={userEmail}
      hasCommitted={hasCommitted ?? false}
    />
  )
}

function WeekBuyBannerActive({
  campaign,
  userId,
  userEmail,
  hasCommitted,
}: {
  campaign: WeekBuyCampaign
  userId?: string | null
  userEmail?: string | null
  hasCommitted: boolean
}) {
  const [seconds, setSeconds] = useState(campaign.seconds_remaining ?? 0)
  const [justCommitted, setJustCommitted] = useState(false)

  useEffect(() => {
    setSeconds(campaign.seconds_remaining ?? 0)
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [campaign.seconds_remaining])

  const hasEnded = seconds <= 0
  const isAuthenticated = !!userId

  // ── Estado: Campaña terminada ──
  if (hasEnded) {
    return (
      <section aria-label="Quincena Munay — terminada">
        <Card className="overflow-hidden border-munay-cacao/10 bg-gradient-to-br from-munay-crema/60 to-munay-crema/80 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <Calendar className="h-8 w-8 text-munay-ink/30" aria-hidden />
            <p className="text-sm font-medium text-munay-ink/50">
              Esta edición de la Quincena Munay ha terminado. ¡La próxima pronto!
            </p>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link href="/flash">Ver otras ofertas</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  // ── Estado: Campaña activa ──
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  return (
    <section aria-label={campaign.title}>
      <Card className="overflow-hidden border-munay-cacao/20 bg-gradient-to-br from-munay-cacao to-munay-cacao/90 shadow-md">
        <CardContent className="flex flex-col gap-5 p-6 text-white sm:p-7">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
              <ShoppingBag className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/60">
                Quincena Munay
              </p>
              <h3 className="font-display text-lg font-bold">{campaign.title}</h3>
            </div>
          </div>

          {/* Descripción */}
          {campaign.description && (
            <p className="text-sm text-white/80">{campaign.description}</p>
          )}

          {/* Grid: Countdown + Progreso + Compromiso */}
          <div className="grid gap-5 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
            {/* Countdown */}
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                Tiempo restante
              </p>
              <p
                className="mt-1 font-mono text-3xl font-bold tabular-nums text-munay-terracota-quemado sm:text-[36px]"
                aria-live="off"
              >
                {pad(h)} : {pad(m)} : {pad(s)}
              </p>
            </div>

            {/* Progreso de compromisos */}
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
                <Users className="h-3.5 w-3.5" aria-hidden />
                Compromisos
              </p>
              <p className="mt-1 text-lg font-bold">
                {campaign.commitments_count} / {campaign.min_commitments}
              </p>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-munay-terracota transition-all duration-500"
                  style={{ width: `${Math.min(100, campaign.progress_percent)}%` }}
                  role="progressbar"
                  aria-valuenow={campaign.commitments_count}
                  aria-valuemin={0}
                  aria-valuemax={campaign.min_commitments}
                />
              </div>
              {campaign.progress_status === 'goal_reached' && (
                <p className="mt-1 text-[11px] font-semibold text-munay-terracota">
                  ¡Meta alcanzada! Descuento asegurado.
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-white/50">
                {campaign.discount_percent}% de descuento al alcanzar la meta
              </p>
            </div>

            {/* Botón compromiso */}
            <div className="flex flex-col items-center gap-2 sm:items-end">
              {hasCommitted || justCommitted ? (
                <div className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white">
                  <CheckCircle className="h-4 w-4 text-munay-turquesa" aria-hidden />
                  Comprometido
                </div>
              ) : isAuthenticated ? (
                <CommitButton
                  campaignId={campaign.id}
                  userEmail={userEmail ?? ''}
                  onCommitted={() => setJustCommitted(true)}
                />
              ) : (
                <Button asChild className="rounded-xl bg-white font-semibold text-munay-cacao hover:bg-white/90">
                  <Link href="/sign-in?redirect_url=/">
                    Comprometerse
                    <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function CommitButton({
  campaignId,
  userEmail,
  onCommitted,
}: {
  campaignId: string
  userEmail: string
  onCommitted: () => void
}) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { ok?: boolean; error?: string } | null) => {
      try {
        const res = await fetch('/api/week-buy/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId, email: userEmail }),
        })
        const data = await res.json()
        if (data.ok) onCommitted()
        return data
      } catch {
        return { ok: false, error: 'Error de conexión' }
      }
    },
    null
  )

  return (
    <form action={formAction}>
      <Button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-white font-semibold text-munay-cacao hover:bg-white/90 disabled:opacity-60 sm:w-auto"
      >
        <Percent className="mr-1.5 h-4 w-4" aria-hidden />
        {isPending ? 'Comprometiéndote…' : '¡Me comprometo!'}
      </Button>
      {state?.error && (
        <p className="mt-1 text-xs text-white/60">{state.error}</p>
      )}
    </form>
  )
}
