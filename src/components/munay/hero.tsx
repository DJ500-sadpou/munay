import Link from 'next/link'
import Image from 'next/image'
import { Sparkles, ShieldCheck, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ROUTES } from '@/lib/constants'
import { TrustStamp } from '@/components/munay/trust-stamp'

const BULLETS = [
  { icon: Sparkles, title: 'Higienizamos', sub: 'profesionalmente' },
  { icon: ShieldCheck, title: 'Verificamos', sub: 'cada prenda' },
  { icon: Tag, title: 'Precios justos', sub: 'para todos' },
]

const AVATARS = ['MA', 'JL', 'CR', 'TG']

export function MunayHero() {
  return (
    <section className="overflow-hidden rounded-3xl border border-black/5 bg-gradient-to-r from-white via-munay-cream/20 to-munay-cream/50 shadow-sm">
      <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr]">
        {/* Copy */}
        <div className="px-6 py-10 lg:py-14 lg:pl-12">
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-munay-ink text-balance sm:text-5xl xl:text-6xl">
            Moda circular,
            <br />
            <span className="text-munay-terracota">nueva y usada.</span>
          </h1>

          <p className="mt-5 text-base font-semibold text-munay-ink/85 sm:text-lg">
            Confianza que se siente. Para estar pinta.
          </p>

          <ul className="mt-7 flex flex-wrap gap-x-8 gap-y-4">
            {BULLETS.map((b) => (
              <li key={b.title} className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-munay-terracota/25 bg-white">
                  <b.icon className="h-4 w-4 text-munay-terracota" aria-hidden />
                </span>
                <span className="text-xs leading-tight text-munay-ink/80">
                  <span className="block font-semibold text-munay-ink">{b.title}</span>
                  {b.sub}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-xl bg-gradient-to-b from-munay-terracota to-munay-terracota-quemado px-7 text-base font-semibold text-white shadow-sm hover:opacity-95"
            >
              <Link href={ROUTES.catalogo}>Comprar ahora</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-xl border-munay-terracota/50 bg-white px-7 text-base font-semibold text-munay-terracota hover:bg-munay-terracota/5 hover:text-munay-terracota-quemado"
            >
              <Link href="/#cupones-y-ofertas">Ver cupones y ofertas</Link>
            </Button>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <div className="flex -space-x-2">
              {AVATARS.map((a) => (
                <Avatar key={a} className="h-8 w-8 border-2 border-white">
                  <AvatarFallback className="bg-munay-crema text-[10px] font-bold text-munay-cacao">
                    {a}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <p className="text-xs font-medium text-munay-ink/70">
              +50K personas ya están pinta con Munay
            </p>
          </div>
        </div>

        {/* Imagen editorial — recortada de la referencia */}
        <div className="relative min-h-[320px] self-stretch lg:min-h-[440px]">
          <Image
            src="/munay/ref-hero-models.webp"
            alt="Dos personas con looks urbanos de moda circular Munay"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-top"
          />
          <TrustStamp className="absolute left-2 top-6 w-24 -rotate-12 lg:-left-10 lg:w-28" />
        </div>
      </div>
    </section>
  )
}
