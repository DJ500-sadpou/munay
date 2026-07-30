import { METRICS } from '@/lib/munay-data'

export function MunayMetrics() {
  return (
    <dl className="grid h-full grid-cols-2 gap-6 rounded-2xl border border-black/5 bg-munay-cream/20 p-6 shadow-sm sm:p-7">
      {METRICS.map((m) => (
        <div key={m.label}>
          <dt className="sr-only">{m.label}</dt>
          <dd>
            <span className="block font-display text-2xl font-extrabold tracking-tight text-munay-terracota">
              {m.value}
            </span>
            <span className="mt-1 block text-[11px] font-medium text-munay-ink/60">
              {m.label}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
