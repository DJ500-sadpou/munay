/**
 * Landing page — MUNAY, moda circular nueva y usada.
 * Desktop-first y responsive. Las rutas funcionales (/catalogo, /carrito, /checkout…)
 * siguen operativas.
 */

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
