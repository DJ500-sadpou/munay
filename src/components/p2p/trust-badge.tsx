'use client'

import { ShieldCheck, Truck, Sparkles } from 'lucide-react'

type TrustType = 'higiene' | 'envio' | 'verificado'

interface TrustBadgeProps {
  type: TrustType
  label?: string
  size?: 'sm' | 'md'
}

const CONFIG: Record<TrustType, { icon: typeof ShieldCheck; defaultLabel: string }> = {
  higiene: { icon: Sparkles, defaultLabel: 'Higienizado' },
  envio: { icon: Truck, defaultLabel: 'Envío seguro' },
  verificado: { icon: ShieldCheck, defaultLabel: 'Verificado por Munay' },
}

/**
 * TrustBadge — Sello de confianza/verificación.
 *
 * Regla de Oro: SIEMPRE en Turquesa (NUNCA en Terracota/Rojo).
 * Representa confianza, no urgencia.
 */
export function TrustBadge({ type, label, size = 'sm' }: TrustBadgeProps) {
  const config = CONFIG[type]
  const Icon = config.icon
  const text = label ?? config.defaultLabel
  const isSm = size === 'sm'

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium text-munay-turquesa ${
        isSm ? 'text-xs' : 'text-sm'
      }`}
    >
      <span className={`flex items-center justify-center rounded-full bg-munay-turquesa/10 ${
        isSm ? 'h-5 w-5' : 'h-6 w-6'
      }`}>
        <Icon className={isSm ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
      </span>
      {text}
    </span>
  )
}
