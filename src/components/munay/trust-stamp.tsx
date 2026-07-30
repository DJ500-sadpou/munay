import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Sello circular "Higienizada y verificada".
 */
export function TrustStamp({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex aspect-square items-center justify-center rounded-full border-2 border-dashed border-munay-red-500 bg-white/95 p-3 text-center shadow-lg',
        className,
      )}
      role="img"
      aria-label="Prenda higienizada y verificada"
    >
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] font-extrabold uppercase leading-tight tracking-wide text-munay-red-600">
          Higienizada
        </span>
        <span className="text-[9px] font-bold uppercase leading-tight tracking-wide text-munay-red-800/80">
          y verificada
        </span>
        <Check className="h-5 w-5 text-munay-red-500" strokeWidth={3} aria-hidden />
      </div>
    </div>
  )
}
