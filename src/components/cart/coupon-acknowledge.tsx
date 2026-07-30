'use client'

import { useState, useEffect } from 'react'
import { Gift, Zap, CheckCircle2, X } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ROUTES } from '@/lib/constants'

interface Props {
  code: string
  discountPercent: number
  expiresAt: string
}

const LS_KEY = 'munay-ack-coupons'

function getAcknowledged(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function markAcknowledged(code: string) {
  try {
    const list = getAcknowledged()
    if (!list.includes(code)) {
      list.push(code)
      localStorage.setItem(LS_KEY, JSON.stringify(list))
    }
  } catch {
    // localStorage no disponible
  }
}

export function CouponAcknowledge({ code, discountPercent, expiresAt }: Props) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const list = getAcknowledged()
    if (list.includes(code)) {
      setAcknowledged(true)
    }
  }, [code])

  const handleAccept = () => {
    markAcknowledged(code)
    setAcknowledged(true)
  }

  const handleDismiss = () => {
    setDismissed(true)
  }

  // Si ya fue aceptado anteriormente o descartado, no mostrar
  if (acknowledged || dismissed) return null

  return (
    <div className="w-full rounded-xl border-2 border-accent/40 bg-gradient-to-br from-accent/10 to-accent/5 p-5 text-center relative animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Botón de cerrar (descartar sin aceptar) */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full text-accent/60 hover:text-accent hover:bg-accent/10 transition-colors"
        aria-label="Descartar cupón"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
        <Gift className="h-6 w-6 text-accent" aria-hidden />
      </div>

      <h2 className="mt-3 font-display text-xl font-bold text-accent">
        🎉 ¡Has descubierto un cupón!
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Gracias por tu compra. Aquí tienes un descuento especial para tu próxima visita.
      </p>

      <Separator className="my-4 bg-accent/20" />

      <div className="space-y-2">
        <p className="text-3xl font-bold text-accent">{discountPercent}% de descuento</p>
        <div className="inline-block rounded-lg bg-background px-5 py-2 font-mono text-lg font-bold tracking-[0.25em]">
          {code}
        </div>
        <p className="text-xs text-muted-foreground">
          Válido hasta{' '}
          {new Date(expiresAt).toLocaleDateString('es-EC', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {' · '}1 uso · Aplica en tu próxima compra
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Button
          onClick={handleAccept}
          variant="default"
          className="w-full"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Aceptar cupón
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={ROUTES.catalogo}>
            <Zap className="mr-2 h-4 w-4" />
            Usar cupón ahora
          </Link>
        </Button>
      </div>
    </div>
  )
}
