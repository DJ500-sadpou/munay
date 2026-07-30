import { Search, ShoppingBag, Truck, Heart, ChevronRight } from 'lucide-react'

const STEPS = [
  { icon: Search, title: '1. Descubrí', desc: 'Explorá miles de prendas nuevas y usadas.' },
  { icon: ShoppingBag, title: '2. Comprá seguro', desc: 'Comprá con confianza, pagá de forma segura.' },
  { icon: Truck, title: '3. Recibí en casa', desc: 'Enviamos rápido y con seguimiento.' },
  { icon: Heart, title: '4. Estar pinta', desc: 'Disfrutá tu prenda y sumate a la moda circular.' },
]

export function MunayHowItWorks() {
  return (
    <section
      id="como-funciona"
      className="rounded-2xl border border-black/5 bg-munay-cream/15 px-6 py-8 shadow-sm sm:px-8"
    >
      <h2 className="text-center font-display text-2xl font-bold tracking-tight text-munay-ink">
        ¿Cómo funciona Munay?
      </h2>

      <ol className="mt-8 flex flex-col items-stretch gap-6 lg:flex-row lg:items-center lg:justify-between">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-1 items-center gap-4">
            <div className="flex flex-1 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-munay-terracota/25 bg-white">
                <s.icon className="h-5 w-5 text-munay-terracota" strokeWidth={1.75} aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-munay-ink">{s.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-munay-ink/60">{s.desc}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight
                className="hidden h-5 w-5 shrink-0 text-munay-ink/25 lg:block"
                aria-hidden
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
