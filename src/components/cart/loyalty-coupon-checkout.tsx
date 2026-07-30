'use client'

import { useState, useEffect } from 'react'
import { Gift, Tag, Check, AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatCents } from '@/lib/format'

interface Coupon {
  id: string
  code: string
  discount_percent: number
  expires_at: string
  created_at: string
}

interface Props {
  subtotalCents: number
  loyaltyCode: string | undefined
  onChange: (code: string | undefined) => void
}

export function LoyaltyCouponCheckout({ subtotalCents, loyaltyCode, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [config, setConfig] = useState<{ enabled: boolean; discount_percent: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user/coupons')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.ok) {
          setCoupons(data.coupons ?? [])
          setConfig(data.config ?? null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Si el sistema está desactivado o no hay cupones, no mostrar nada
  if (loading) return null
  if (!config?.enabled) return null
  if (coupons.length === 0) return null

  const selectedCoupon = coupons.find((c) => c.code === loyaltyCode)
  const discountForSelected = selectedCoupon
    ? Math.round(subtotalCents * (selectedCoupon.discount_percent / 100))
    : 0

  const handleSelect = (code: string) => {
    if (loyaltyCode === code) {
      onChange(undefined) // deseleccionar
    } else {
      onChange(code)
    }
  }

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader
        className="pb-3 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-accent" aria-hidden />
            Cupón de fidelidad
            {loyaltyCode && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                −{discountForSelected > 0 ? formatCents(discountForSelected) : `${selectedCoupon?.discount_percent ?? 0}%`}
              </span>
            )}
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 space-y-2">
          <p className="text-xs text-muted-foreground">
            Tienes <strong className="text-foreground">{coupons.length}</strong> cupón
            {coupons.length !== 1 ? 'es' : ''} activo
            {coupons.length !== 1 ? 's' : ''}. Selecciona uno para aplicarlo.
          </p>
          <Separator />
          <div className="space-y-2">
            {coupons.map((c) => {
              const discount = Math.round(subtotalCents * (c.discount_percent / 100))
              const isSelected = c.code === loyaltyCode
              const expiresIn = Math.ceil(
                (new Date(c.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              )
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c.code)}
                  className={`w-full text-left rounded-lg border p-3 transition-all ${
                    isSelected
                      ? 'border-accent bg-accent/10 ring-1 ring-accent'
                      : 'border-border/60 hover:border-accent/40 hover:bg-accent/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-accent" aria-hidden />
                      <div>
                        <code className="text-sm font-bold font-mono tracking-wider">{c.code}</code>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.discount_percent}% de descuento · 
                          {expiresIn <= 0
                            ? ' Vence hoy'
                            : expiresIn === 1
                            ? ' Expira mañana'
                            : ` Expira en ${expiresIn} días`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-medium text-accent">−{formatCents(discount)}</span>
                      {isSelected && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent">
                          <Check className="h-3 w-3 text-accent-foreground" />
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          {loyaltyCode && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(undefined)}
              className="w-full text-xs text-muted-foreground"
            >
              Quitar cupón
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  )
}
