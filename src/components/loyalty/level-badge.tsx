'use client'

import { Sparkles, Crown, Shield, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LEVELS_CONFIG, type LevelKey, resolveLevelKey } from '@/lib/queries/loyalty-points'

interface LevelBadgeProps {
  levelName?: string
  levelKey?: LevelKey
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showIcon?: boolean
}

/** Mapa de iconos por nivel */
const LEVEL_ICONS: Record<string, typeof Sparkles> = {
  bronce: Shield,
  plata: Sparkles,
  oro: Crown,
  andino: Star,
}

/** Mapa de colores Tailwind por nivel */
const LEVEL_STYLES: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  bronce: {
    bg: 'bg-munay-warm-gray/10',
    text: 'text-munay-warm-gray',
    border: 'border-munay-warm-gray/30',
    ring: 'ring-munay-warm-gray/20',
  },
  plata: {
    bg: 'bg-munay-turquesa/10',
    text: 'text-munay-turquesa',
    border: 'border-munay-turquesa/30',
    ring: 'ring-munay-turquesa/20',
  },
  oro: {
    bg: 'bg-munay-terracota/10',
    text: 'text-munay-terracota',
    border: 'border-munay-terracota/30',
    ring: 'ring-munay-terracota/20',
  },
  andino: {
    bg: 'bg-munay-cacao/10',
    text: 'text-munay-cacao',
    border: 'border-munay-cacao/30',
    ring: 'ring-munay-cacao/20',
  },
}

export function LevelBadge({
  levelName,
  levelKey,
  size = 'md',
  className,
  showIcon = true,
}: LevelBadgeProps) {
  // Determinar key: si recibimos name, buscar; si no, usar levelKey
  const resolvedKey = levelKey ?? resolveLevelKey(levelName)
  const styles = LEVEL_STYLES[resolvedKey] ?? LEVEL_STYLES.bronce
  const Icon = LEVEL_ICONS[resolvedKey] ?? Shield
  const label = levelName ?? resolvedKey.charAt(0).toUpperCase() + resolvedKey.slice(1)

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[9px] gap-1',
    md: 'px-2 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  }

  const iconSizes = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-semibold uppercase tracking-wider',
        styles.bg,
        styles.text,
        styles.border,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className={cn('shrink-0', iconSizes[size])} aria-hidden />}
      {label}
    </span>
  )
}

