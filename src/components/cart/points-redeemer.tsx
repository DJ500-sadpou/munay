'use client'

import { Sparkles, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { formatCents } from '@/lib/format'
import { POINTS_RULES } from '@/lib/constants'

interface Props {
  balance: number
  subtotalCents: number
  // Cantidad de puntos seleccionados para redimir (0 si no hay)
  selected: number
  onChange: (points: number) => void
}

export function PointsRedeemer({ balance, subtotalCents, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)

  if (balance < POINTS_RULES.MIN_POINTS_TO_REDEEM) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm">
        <p className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-4 w-4" aria-hidden />
          <span>
            Tienes <strong className="text-foreground">{balance} pts</strong>. Necesitas al menos{' '}
            {POINTS_RULES.MIN_POINTS_TO_REDEEM} para redimir.
          </span>
        </p>
      </div>
    )
  }

  // Máximo teórico: el saldo o lo que cubre el subtotal, lo que sea menor
  const maxByBalance = Math.floor(balance / POINTS_RULES.MIN_POINTS_TO_REDEEM) * POINTS_RULES.MIN_POINTS_TO_REDEEM
  const maxBySubtotal = Math.floor(subtotalCents / 100) * POINTS_RULES.POINTS_PER_DISCOUNT_DOLLAR
  const maxRedeemable = Math.min(maxByBalance, maxBySubtotal)
  const discountForMax = Math.floor(maxRedeemable / POINTS_RULES.POINTS_PER_DISCOUNT_DOLLAR) * 100
  const discountForSelected = Math.floor(selected / POINTS_RULES.POINTS_PER_DISCOUNT_DOLLAR) * 100

  const handleUseMax = () => {
    onChange(maxRedeemable)
  }

  const handleClear = () => {
    onChange(0)
  }

  const handleCustom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.floor(Number(e.target.value))
    if (isNaN(v) || v < 0) {
      onChange(0)
      return
    }
    // Redondear al múltiplo inferior
    const rounded = Math.floor(v / POINTS_RULES.MIN_POINTS_TO_REDEEM) * POINTS_RULES.MIN_POINTS_TO_REDEEM
    onChange(Math.min(rounded, maxRedeemable))
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setOpen(!open)}>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            Redimir puntos
            {selected > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                −{formatCents(discountForSelected)}
              </span>
            )}
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 space-y-3">
          <p className="text-xs text-muted-foreground">
            Saldo: <strong className="text-foreground">{balance} pts</strong> · Equivalente máximo:{' '}
            <strong className="text-foreground">{formatCents(discountForMax)}</strong>
          </p>

          <div className="space-y-2">
            <Label htmlFor="points-input" className="text-xs">
              Puntos a redimir (múltiplos de {POINTS_RULES.MIN_POINTS_TO_REDEEM})
            </Label>
            <Input
              id="points-input"
              type="number"
              min={0}
              max={maxRedeemable}
              step={POINTS_RULES.MIN_POINTS_TO_REDEEM}
              value={selected || ''}
              onChange={handleCustom}
              placeholder="0"
              className="font-mono"
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleUseMax} className="flex-1">
              Usar máximo ({maxRedeemable} pts)
            </Button>
            {selected > 0 && (
              <Button type="button" size="sm" variant="ghost" onClick={handleClear}>
                Quitar
              </Button>
            )}
          </div>

          {selected > 0 && (
            <>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {selected} puntos = {formatCents(discountForSelected)} de descuento
                </span>
                <span className="text-primary font-medium flex items-center gap-1">
                  <Check className="h-3 w-3" aria-hidden />
                  Aplicado
                </span>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}
