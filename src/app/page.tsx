/**
 * Landing page — MUNAY, moda circular nueva y usada.
 * Desktop-first y responsive. Las rutas funcionales (/catalogo, /carrito, /checkout…)
 * siguen operativas.
 */

import Link from 'next/link'
import { Construction } from 'lucide-react'
import { PendingCouponBanner } from '@/components/cart/pending-coupon-banner'
import { MunayHero } from '@/components/munay/hero'
import { MunayCategoryBar } from '@/components/munay/category-bar'
import { MunayFlashOffers } from '@/components/munay/flash-offers'
import { MunayLiveCodes } from '@/components/munay/live-codes'
import { MunayTrustBar } from '@/components/munay/trust-bar'
import { MunayHowItWorks } from '@/components/munay/how-it-works'
import { MunayTestimonials } from '@/components/munay/testimonials'
import { MunayMetrics } from '@/components/munay/metrics'
import { MunayCtaWeb } from '@/components/munay/cta-web'
import { MunayNewsletter } from '@/components/munay/newsletter'

export default function Home() {
  return (
    <div className="bg-gradient-to-b from-white via-munay-cream/10 to-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 lg:px-6 lg:py-8">
        <PendingCouponBanner />

        {/* MAINTENANCE BANNER */}
        <div className="rounded-2xl border border-munay-red-500/20 bg-munay-red-500/5 px-5 py-3 text-center text-sm">
          <Construction className="mr-1.5 inline h-4 w-4 text-munay-red-500" aria-hidden />
          <span className="text-munay-ink/80">
            <strong className="text-munay-red-600">Munay está en construcción.</strong>{' '}
            El catálogo, carrito y checkout ya están operativos —{' '}
            <Link href="/catalogo" className="font-semibold text-munay-red-600 underline hover:no-underline">
              visítalos aquí
            </Link>.
          </span>
        </div>

        <MunayHero />

        <MunayCategoryBar />

        <section
          aria-label="Ofertas flash y códigos en vivo"
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]"
        >
          <MunayFlashOffers />
          <MunayLiveCodes />
        </section>

        <MunayTrustBar />

        <MunayHowItWorks />

        <section
          aria-label="Reseñas y métricas"
          className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
        >
          <MunayTestimonials />
          <MunayMetrics />
        </section>

        <MunayCtaWeb />

        <MunayNewsletter />
      </div>
    </div>
  )
}
