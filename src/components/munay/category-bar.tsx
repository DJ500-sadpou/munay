import Link from 'next/link'
import { CATEGORIES } from '@/lib/munay-data'

export function MunayCategoryBar() {
  return (
    <nav
      aria-label="Categorías"
      className="rounded-2xl border border-black/5 bg-white shadow-sm"
    >
      <ul className="flex items-stretch gap-1 overflow-x-auto px-3 py-3 sm:justify-between sm:px-4">
        {CATEGORIES.map((c) => (
          <li key={c.label} className="shrink-0">
            <Link
              href={c.href}
              className="flex w-[92px] flex-col items-center gap-2 rounded-xl px-2 py-2 text-center transition-colors hover:bg-munay-cream/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-munay-red-500"
            >
              <c.icon className="h-6 w-6 text-munay-ink/70" strokeWidth={1.5} aria-hidden />
              <span className="text-[11px] font-medium leading-tight text-munay-ink/80">
                {c.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
