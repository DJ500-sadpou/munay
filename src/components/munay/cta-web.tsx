import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants'

export function MunayCtaWeb() {
  return (
    <section className="relative flex flex-col items-center justify-between gap-6 overflow-hidden rounded-2xl bg-gradient-to-r from-munay-red-500 to-munay-red-800 px-6 py-10 shadow-sm sm:px-10 lg:flex-row">
      <div className="relative z-10">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-white text-balance sm:text-3xl">
          Sumate a Munay y encontrá tu próxima pinta
        </h2>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            asChild
            size="lg"
            className="rounded-xl bg-white px-7 font-semibold text-munay-red-600 hover:bg-white/90"
          >
            <Link href="/sign-up">Crear cuenta</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-xl border-white/60 bg-transparent px-7 font-semibold text-white hover:bg-white/10 hover:text-white"
          >
            <Link href={ROUTES.miCuenta}>Publicar prenda</Link>
          </Button>
        </div>
      </div>

      {/* Mockup de app — decorativo */}
      <div className="pointer-events-none relative z-10 hidden h-32 w-24 shrink-0 sm:block lg:h-36 lg:w-28">
        <Image
          src="/munay/ref-app-phone.webp"
          alt=""
          fill
          sizes="120px"
          className="object-contain object-bottom"
          aria-hidden
        />
      </div>
    </section>
  )
}
