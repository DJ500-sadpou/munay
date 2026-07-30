'use client'

import { useState, useEffect } from 'react'
import { Gift, Zap, CheckCircle2, X, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/lib/constants'

interface Coupon {
  code: string
  discount_percent: number
  expires_at: string
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

export function PendingCouponBanner() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Cargar cupones activos del usuario
    fetch('/api/user/coupons')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.ok && data.coupons) {
          const ack = getAcknowledged()
          setAcknowledged(new Set(ack))
          // Solo mostrar los que NO han sido aceptados
          const pending = data.coupons.filter((c: Coupon) => !ack.includes(c.code))
          setCoupons(pending)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleAccept = (code: string) => {
    markAcknowledged(code)
    setCoupons((prev) => prev.filter((c) => c.code !== code))
  }

  const handleDismissAll = () => {
    // Marcar todos como aceptados para no volver a mostrar
    coupons.forEach((c) => markAcknowledged(c.code))
    setCoupons([])
    setDismissed(true)
  }

  if (loading || coupons.length === 0 || dismissed) return null

  return (
    <div className="container mx-auto px-4 pt-4">
      <Card className="border-accent/30 bg-gradient-to-br from-accent/5 via-accent/5 to-background overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20">
                  <Gift className="h-4 w-4 text-accent" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-semibold text-accent">
                    Tienes {coupons.length} cupón{coupons.length !== 1 ? 'es' : ''} de fidelidad pendiente{coupons.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {coupons.length === 1
                      ? `Ganaste un ${coupons[0].discount_percent}% de descuento en tu última compra. No lo pierdas.`
                      : `Ganaste descuentos en tus últimas compras. Canjéalos antes de que expiren.`}
                  </p>
                </div>
              </div>

              {/* Lista de cupones pendientes */}
              <div className="flex flex-wrap gap-2">
                {coupons.map((c) => {
                  const expiresIn = Math.ceil(
                    (new Date(c.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  )
                  return (
                    <div
                      key={c.code}
                      className="flex items-center gap-2 rounded-lg border border-accent/30 bg-background/80 px-3 py-2 text-sm"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" aria-hidden />
                      <code className="font-mono text-xs font-bold tracking-wider">{c.code}</code>
                      <span className="text-accent font-semibold">−{c.discount_percent}%</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          expiresIn <= 1 ? 'border-destructive text-destructive' : ''
                        }`}
                      >
                        {expiresIn <= 0
                          ? 'Vence hoy'
                          : expiresIn === 1
                          ? '1 día'
                          : `${expiresIn} días`}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleAccept(c.code)}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
                        aria-label={`Aceptar cupón ${c.code}`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-2">
                <Button asChild size="sm" variant="default">
                  <Link href={ROUTES.catalogo}>
                    <Zap className="mr-1.5 h-3.5 w-3.5" />
                    Usar cupones
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismissAll}>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Descartar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
