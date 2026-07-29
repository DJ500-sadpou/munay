'use client'

/**
 * Widget de Cloudflare Turnstile.
 *
 * Carga el script de Turnstile y renderiza el widget en un div contenedor.
 * Cuando el usuario completa el challenge, llama a onVerify con el token.
 *
 * Si NEXT_PUBLIC_TURNSTILE_SITE_KEY no está configurado, renderiza un
 * mensaje de "modo dev" y llama a onVerify con un token dummy.
 */

import { useEffect, useRef, useState } from 'react'
import { ShieldCheck, AlertCircle } from 'lucide-react'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: any) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

interface Props {
  onVerify: (token: string | null) => void
  className?: string
}

type WidgetStatus = 'loading' | 'ready' | 'error' | 'dev'

function detectInitialMode(siteKey: string | undefined): WidgetStatus {
  if (!siteKey || siteKey.includes('YOUR-SITE-KEY')) {
    return 'dev'
  }
  return 'loading'
}

export function TurnstileWidget({ onVerify, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const [status, setStatus] = useState<WidgetStatus>(() => detectInitialMode(siteKey))

  // Notificar al padre en modo dev (en un effect para evitar setState during render)
  useEffect(() => {
    if (status === 'dev') {
      onVerify('dev-mode-no-turnstile')
    }
  }, [status, onVerify])

  // Cargar script de Turnstile. Cuando cargue (onload/onerror), setea status.
  // Si el script ya está cargado, marcamos ready vía microtask (no síncrono).
  useEffect(() => {
    if (status !== 'loading') return
    if (!siteKey) return

    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')
    if (existing) {
      // Script ya cargado: si window.turnstile está disponible, marcar ready en próxima microtask
      queueMicrotask(() => {
        if (window.turnstile) {
          setStatus('ready')
        }
      })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = () => setStatus('ready')
    script.onerror = () => setStatus('error')
    document.head.appendChild(script)
  }, [status, siteKey])

  // Renderizar widget cuando esté listo
  useEffect(() => {
    if (status !== 'ready' || !containerRef.current || !window.turnstile || !siteKey) return

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => onVerify(token),
      'expired-callback': () => onVerify(null),
      'error-callback': () => {
        setStatus('error')
        onVerify(null)
      },
      theme: 'auto',
      size: 'normal',
    })

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {/* noop */}
      }
    }
  }, [status, siteKey, onVerify])

  if (status === 'dev') {
    return (
      <div className={`flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground ${className ?? ''}`}>
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        <span>Modo dev: Turnstile no configurado. En producción se muestra el challenge aquí.</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={`flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive ${className ?? ''}`}>
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        <span>Error cargando Turnstile. Recarga la página.</span>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={className}
      role="complementary"
      aria-label="Verificación anti-bot"
    />
  )
}
