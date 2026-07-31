'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface Props {
  whatsappUrl: string
  orderId?: string
}

/**
 * Auto-redirige a WhatsApp después de 3 segundos.
 * Usa window.location.href en vez de window.open para evitar popup blockers.
 * Si el usuario no quiere ir a WhatsApp, puede hacer clic en "Quédate aquí".
 */
export function AutoWhatsappRedirect({ whatsappUrl, orderId }: Props) {
  const [countdown, setCountdown] = useState(3)
  const [redirected, setRedirected] = useState(false)

  useEffect(() => {
    if (redirected) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Abrir WhatsApp después de 3s (consistente con el countdown)
    const redirectTimer = setTimeout(() => {
      setRedirected(true)
      // location.href es más fiable que window.open (no bloqueado por popup blockers)
      window.location.href = whatsappUrl
    }, 3000)

    return () => {
      clearInterval(timer)
      clearTimeout(redirectTimer)
    }
  }, [whatsappUrl, redirected])

  if (redirected) return null

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-center gap-2 text-sm text-munay-whatsapp">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>Abriendo WhatsApp en {countdown} segundos…</span>
      </div>
      <p className="text-center text-xs text-munay-ink/50">
        ¿No quieres ir?{' '}
        <button
          type="button"
          onClick={() => setRedirected(true)}
          className="font-medium text-munay-whatsapp underline underline-offset-2"
        >
          Quédate aquí
        </button>
        {' · '}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-munay-whatsapp underline underline-offset-2"
        >
          Abrir ahora
        </a>
      </p>
    </div>
  )
}
