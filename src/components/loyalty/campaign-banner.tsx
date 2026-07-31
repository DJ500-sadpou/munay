'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Zap, Sparkles, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Campaign } from '@/types/campaign'

interface CampaignBannerProps {
  campaign: Campaign
}

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

/**
 * CampaignBanner — Banner de oferta flash / Quincena MUNAY con countdown a fecha real.
 *
 * El countdown se calcula desde `campaign.seconds_remaining` (servidor)
 * y se actualiza cada segundo en el cliente.
 */
export function CampaignBanner({ campaign }: CampaignBannerProps) {
  const [seconds, setSeconds] = useState(campaign.seconds_remaining ?? 0)

  useEffect(() => {
    setSeconds(campaign.seconds_remaining ?? 0)
    const id = setInterval(() => {
      setSeconds((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [campaign.seconds_remaining])

  // Calcular estado local
  const hasEnded = seconds <= 0

  // Si la campaña terminó, mostrar estado "Próxima oferta"
  if (hasEnded) {
    return (
      <div className="relative flex h-full overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br from-munay-crema/50 to-munay-crema/80 shadow-sm">
        <div className="relative z-10 flex flex-col gap-3 p-6 sm:p-7">
          <h2 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-wide text-munay-ink/40">
            <Clock className="h-5 w-5" aria-hidden />
            {campaign.type === 'quincena' ? 'Quincena MUNAY' : 'Ofertas Flash'}
          </h2>
          <p className="text-sm text-munay-ink/40">Próxima oferta pronto — estate atento</p>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-fit rounded-xl"
          >
            <Link href="/flash">Ver códigos activos</Link>
          </Button>
        </div>
      </div>
    )
  }

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const isQuincena = campaign.type === 'quincena'

  return (
    <div className={`relative flex h-full overflow-hidden rounded-2xl border border-black/5 shadow-sm ${
      isQuincena
        ? 'bg-gradient-to-br from-munay-cacao to-munay-terracota-quemado'
        : 'bg-gradient-to-br from-munay-terracota to-munay-terracota-quemado'
    }`}>
      <div className="relative z-10 flex flex-col gap-4 p-6 sm:p-7">
        <h2 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-wide text-white">
          {isQuincena ? (
            <Sparkles className="h-5 w-5 fill-white" aria-hidden />
          ) : (
            <Zap className="h-5 w-5 fill-white" aria-hidden />
          )}
          {isQuincena ? 'Quincena MUNAY' : 'Ofertas Flash'}
        </h2>
        <p className="text-sm text-white/85">
          {campaign.description ?? (isQuincena
            ? 'Descuentos especiales por tiempo limitado — nueva edición cada 15 días'
            : 'Descuentos que no duran nada')}
        </p>

        {/* Categoría temática (solo Quincena MUNAY) */}
        {isQuincena && campaign.categoria_tematica && (
          <span className="inline-block w-fit rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/80">
            {campaign.categoria_tematica}
          </span>
        )}

        {/* Countdown numérico */}
        <div>
          <p
            className="font-mono text-4xl font-bold tabular-nums text-white sm:text-[42px]"
            aria-live="off"
          >
            {pad(h)} : {pad(m)} : {pad(s)}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
            Termina en
          </p>
        </div>

        <Button
          asChild
          className="mt-2 w-fit rounded-xl bg-white px-5 font-semibold text-munay-terracota hover:bg-white/90"
        >
          <Link href={isQuincena ? `/catalogo?campaign=${campaign.id}` : '/flash'}>
            {isQuincena ? 'Ver ofertas' : 'Ver todas las ofertas'}
          </Link>
        </Button>
      </div>
    </div>
  )
}

/**
 * CampaignBannerSkeleton — Placeholder mientras se carga la campaña.
 */
export function CampaignBannerSkeleton() {
  return (
    <div className="flex h-full animate-pulse items-center justify-center rounded-2xl border border-black/5 bg-munay-crema/20 p-6 shadow-sm sm:p-7">
      <div className="w-full space-y-4">
        <div className="h-6 w-40 rounded bg-munay-crema/30" />
        <div className="h-4 w-60 rounded bg-munay-crema/30" />
        <div className="h-10 w-48 rounded bg-munay-crema/30" />
      </div>
    </div>
  )
}
