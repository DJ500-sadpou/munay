import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants'

export function MunayCtaWeb() {
  return (
    <section className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-munay-terracota to-munay-terracota-quemado px-6 py-10 shadow-sm sm:px-10 lg:flex-row">
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-white text-balance sm:text-3xl">
        Sumate a Munay y encontrá tu próxima pinta
      </h2>

      <div className="flex flex-wrap gap-3">
        <Button
          asChild
          size="lg"
          className="rounded-xl bg-white px-7 font-semibold text-munay-terracota hover:bg-white/90"
        >
          <Link href="/sign-up">Crear cuenta</Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="rounded-xl border-white/60 bg-transparent px-7 font-semibold text-white hover:bg-white/10 hover:text-white"
        >
          <Link href="/publicar">Publicar prenda</Link>
        </Button>
      </div>
    </section>
  )
}
