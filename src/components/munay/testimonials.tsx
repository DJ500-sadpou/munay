import { Star } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { TESTIMONIALS } from '@/lib/munay-data'

function Stars({ className = '' }: { className?: string }) {
  return (
    <div className={`flex gap-0.5 ${className}`} aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-munay-red-500 text-munay-red-500" />
      ))}
    </div>
  )
}

export function MunayTestimonials() {
  return (
    <div className="grid gap-6 rounded-2xl border border-black/5 bg-white p-6 shadow-sm lg:grid-cols-[minmax(0,220px)_1fr] sm:p-7">
      <div>
        <h2 className="font-display text-2xl font-bold leading-tight tracking-tight text-munay-ink text-balance">
          Miles de personas ya están pinta
        </h2>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm font-semibold text-munay-ink">Excelente</span>
          <Stars />
        </div>
        <p className="mt-2 text-xs text-munay-ink/60">4.9/5 en más de 10.000 reseñas</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <li
            key={t.name}
            className="rounded-xl border border-black/5 bg-munay-cream/15 p-4"
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-munay-red-500/10 text-[10px] font-bold text-munay-red-800">
                  {t.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs font-semibold text-munay-ink">{t.name}</p>
                <Stars />
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-munay-ink/70">{t.quote}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
