/**
 * MunayPageShell — Layout wrapper que unifica padding, fondos y tipografía
 * en todas las páginas del sitio. Reemplaza el patrón repetitivo
 * `container mx-auto px-4 py-10` en cada página.
 */
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  title?: string
  description?: string
  badge?: string
  /** Clases adicionales para el contenedor interno */
  className?: string
  /** Ancho máximo (default: max-w-7xl) */
  size?: 'sm' | 'md' | 'lg' | 'full'
  /** Sin gradiente de fondo */
  noGradient?: boolean
}

const sizeMap = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-7xl',
  full: 'max-w-none',
}

export function MunayPageShell({
  children,
  title,
  description,
  badge,
  className = '',
  size = 'lg',
  noGradient = false,
}: Props) {
  return (
    <div className={noGradient ? '' : 'bg-gradient-to-b from-white via-munay-cream/10 to-white'}>
      <div className={`mx-auto px-4 py-8 lg:px-6 lg:py-10 ${sizeMap[size]} ${className}`}>
        {badge && (
          <span className="mb-3 inline-block rounded-full bg-munay-red-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-munay-red-600">
            {badge}
          </span>
        )}
        {title && (
          <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink sm:text-4xl">
            {title}
          </h1>
        )}
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-munay-ink/60 sm:text-base">
            {description}
          </p>
        )}
        {(title || description) && <div className="mt-8" />}
        {children}
      </div>
    </div>
  )
}
