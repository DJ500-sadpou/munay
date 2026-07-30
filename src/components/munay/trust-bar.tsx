import { Sparkles, ShieldCheck, Lock, Users } from 'lucide-react'
import { TrustStamp } from '@/components/munay/trust-stamp'

const ITEMS = [
  {
    icon: Sparkles,
    title: 'Higienización premium',
    desc: 'Cada prenda pasa por un proceso profesional.',
  },
  {
    icon: ShieldCheck,
    title: 'Verificación real',
    desc: 'Revisamos autenticidad y estado de cada producto.',
  },
  {
    icon: Lock,
    title: 'Compra protegida',
    desc: 'Pagos seguros y devoluciones fáciles.',
  },
  {
    icon: Users,
    title: 'Comunidad Munay',
    desc: 'Miles de personas eligen moda circular todos los días.',
  },
]

export function MunayTrustBar() {
  return (
    <section className="relative rounded-2xl border border-black/5 bg-munay-cream/20 px-6 py-8 shadow-sm sm:px-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,200px)_1fr] xl:pr-28">
        <h2 className="max-w-[220px] font-display text-2xl font-bold tracking-tight text-munay-ink text-balance">
          Confianza que se siente
        </h2>

        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {ITEMS.map((i) => (
            <li key={i.title} className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-munay-red-500/25 bg-white">
                <i.icon className="h-4 w-4 text-munay-red-500" aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-munay-ink">{i.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-munay-ink/60">{i.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <TrustStamp className="absolute -right-4 top-1/2 hidden w-24 -translate-y-1/2 rotate-6 xl:block" />
    </section>
  )
}
