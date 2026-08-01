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
import { MunayCouponCards } from '@/components/munay/coupon-cards'
import { MunayTrustBar } from '@/components/munay/trust-bar'
import { MunayHowItWorks } from '@/components/munay/how-it-works'
import { MunayTestimonials } from '@/components/munay/testimonials'
import { MunayMetrics } from '@/components/munay/metrics'
import { MunayCtaWeb } from '@/components/munay/cta-web'
import { MunayNewsletter } from '@/components/munay/newsletter'
import { CampaignBanner, CampaignBannerSkeleton } from '@/components/loyalty/campaign-banner'
import { getActiveCampaign } from '@/lib/queries/flash-campaigns'
import { getActiveCouponsForUser } from '@/lib/queries/coupons'
import { WeekBuyBanner } from '@/components/loyalty/week-buy-banner'
import { getActiveWeekBuy, hasUserCommitted } from '@/lib/queries/week-buy'
import { currentUser } from '@clerk/nextjs/server'
import { Suspense } from 'react'

async function safeFetchActiveWeekBuy() {
  try { return await getActiveWeekBuy() } catch { return null }
}

async function safeFetchActiveCampaign() {
  try { return await getActiveCampaign() } catch { return null }
}

// [F1.3] Pasa userId/email (de currentUser, server-side) a
// getActiveCouponsForUser: guests NO ven cupones de primera_compra y
// usuarios con compras pagadas previas tampoco.
async function safeFetchActiveCoupons(userId?: string | null, email?: string | null) {
  try { return await getActiveCouponsForUser(userId, email) } catch { return [] }
}

async function safeHasUserCommitted(campaignId: string, userId: string) {
  try { return await hasUserCommitted(campaignId, userId) } catch { return false }
}

async function WeekBuySection() {
  const campaign = await safeFetchActiveWeekBuy()

  if (!campaign) {
    return <WeekBuyBanner campaign={null} />
  }

  const user = await currentUser()
  const hasCommitted = user ? await safeHasUserCommitted(campaign.id, user.id) : false

  return (
    <WeekBuyBanner
      campaign={campaign}
      userId={user?.id}
      userEmail={user?.emailAddresses?.[0]?.emailAddress}
      hasCommitted={hasCommitted}
    />
  )
}

async function FlashCampaignsGrid() {
  // [F1.3] Contexto de usuario real (server-side) para filtrar primera_compra.
  const user = await currentUser()
  const [campaign, coupons] = await Promise.all([
    safeFetchActiveCampaign(),
    safeFetchActiveCoupons(
      user?.id ?? null,
      user?.emailAddresses?.[0]?.emailAddress ?? null
    ),
  ])
  const hasCampaign = !!campaign

  return (
    <section
      id="cupones-y-ofertas"
      aria-label="Cupones"
      className={`grid gap-6 ${hasCampaign ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]' : 'lg:grid-cols-1'}`}
    >
      {campaign ? <CampaignBanner campaign={campaign} /> : null}
      <MunayCouponCards coupons={coupons} />
    </section>
  )
}

export default function Home() {
  return (
    <div className="bg-gradient-to-b from-white via-munay-crema/10 to-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 lg:px-6 lg:py-8">
        <PendingCouponBanner />

        {/* MAINTENANCE BANNER */}
        <div className="rounded-2xl border border-munay-terracota/20 bg-munay-terracota/5 px-5 py-3 text-center text-sm">
          <Construction className="mr-1.5 inline h-4 w-4 text-munay-terracota" aria-hidden />
          <span className="text-munay-ink/80">
            <strong className="text-munay-terracota-quemado">Munay está en construcción.</strong>{' '}
            El catálogo, carrito y checkout ya están operativos —{' '}
            <Link href="/catalogo" className="font-semibold text-munay-terracota underline hover:no-underline">
              visítalos aquí
            </Link>.
          </span>
        </div>

        <MunayHero />

        <MunayCategoryBar />

        <Suspense fallback={
          <div className="h-48 animate-pulse rounded-2xl bg-munay-crema/20" />
        }>
          <FlashCampaignsGrid />
        </Suspense>

        <Suspense fallback={
          <div className="h-[200px] animate-pulse rounded-2xl bg-munay-crema/20" />
        }>
          <WeekBuySection />
        </Suspense>

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
