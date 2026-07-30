'use client'

import { TrendingUp, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LevelBadge } from '@/components/loyalty/level-badge'
import { type LevelKey, resolveLevelKey } from '@/lib/queries/loyalty-points'

interface LevelProgressBarProps {
  currentLevelName: string
  currentLevelKey?: LevelKey
  pointsBalance: number
  nextLevel: {
    name: string
    min_points: number
    points_needed: number
    progress_percent: number
  } | null
  className?: string
}

/** Colores de la barra de progreso según nivel actual */
const PROGRESS_COLORS: Record<string, string> = {
  bronce: 'bg-munay-warm-gray',
  plata: 'bg-munay-turquesa',
  oro: 'bg-munay-terracota',
  andino: 'bg-munay-cacao',
}

export function LevelProgressBar({
  currentLevelName,
  currentLevelKey,
  pointsBalance,
  nextLevel,
  className,
}: LevelProgressBarProps) {
  const resolvedKey = currentLevelKey ?? resolveLevelKey(currentLevelName)
  const progressColor = PROGRESS_COLORS[resolvedKey] ?? PROGRESS_COLORS.bronce

  return (
    <div className={cn('space-y-3', className)}>
      {/* Nivel actual + badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LevelBadge levelName={currentLevelName} size="md" />
        </div>
        <span className="text-sm font-semibold text-munay-ink">
          {pointsBalance} pts
        </span>
      </div>

      {nextLevel ? (
        <>
          {/* Barra de progreso */}
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-munay-crema/30">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500 ease-out',
                progressColor
              )}
              style={{ width: `${Math.min(100, nextLevel.progress_percent)}%` }}
              role="progressbar"
              aria-valuenow={nextLevel.progress_percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progreso hacia ${nextLevel.name}: ${nextLevel.progress_percent}%`}
            />
          </div>

          {/* Info del siguiente nivel */}
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-munay-ink/60">
              <TrendingUp className="h-3 w-3" aria-hidden />
              Faltan{' '}
              <strong className="text-munay-ink">
                {nextLevel.points_needed} pts
              </strong>{' '}
              para{' '}
              <span className="font-semibold text-munay-ink">{nextLevel.name}</span>
            </span>
            <span className="text-munay-ink/40">{nextLevel.progress_percent}%</span>
          </div>
        </>
      ) : (
        /* Nivel máximo alcanzado */
        <div className="flex items-center gap-2 rounded-lg border border-munay-cacao/20 bg-munay-cacao/5 px-3 py-2">
          <Sparkles className="h-4 w-4 text-munay-cacao" aria-hidden />
          <p className="text-xs font-medium text-munay-cacao">
            ¡Nivel máximo alcanzado! Sigues acumulando puntos para beneficios exclusivos.
          </p>
        </div>
      )}
    </div>
  )
}


