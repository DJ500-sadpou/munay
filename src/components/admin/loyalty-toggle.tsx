'use client'

import { useState, useTransition } from 'react'
import { Gift, Loader2, CheckCircle2, AlertCircle, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'

interface Props {
  initialEnabled: boolean
  initialMin: number
  initialMax: number
}

export function LoyaltyToggle({ initialEnabled, initialMin, initialMax }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [minPercent, setMinPercent] = useState(initialMin)
  const [maxPercent, setMaxPercent] = useState(initialMax)
  const [saving, startSaving] = useTransition()
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const clamp = (v: number) => Math.max(1, Math.min(99, v))

  const handleMinChange = (v: string) => {
    const val = clamp(Number(v) || 1)
    setMinPercent(val)
    if (val > maxPercent) setMaxPercent(val)
  }

  const handleMaxChange = (v: string) => {
    const val = clamp(Number(v) || 1)
    setMaxPercent(val)
    if (val < minPercent) setMinPercent(val)
  }

  const handleSave = () => {
    setStatus('saving')
    startSaving(async () => {
      try {
        const res = await fetch('/api/admin/loyalty-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled,
            min_discount_percent: minPercent,
            max_discount_percent: maxPercent,
          }),
        })
        const data = await res.json()
        if (data.ok) {
          setStatus('saved')
          setTimeout(() => setStatus('idle'), 2000)
        } else {
          setStatus('error')
        }
      } catch {
        setStatus('error')
      }
    })
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" aria-hidden />
            <span className="font-medium">Cupones de fidelidad</span>
            <Badge variant={enabled ? 'default' : 'outline'}>
              {minPercent}% — {maxPercent}%
            </Badge>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label="Activar cupones de fidelidad"
          />
        </div>

        <p className="text-sm text-muted-foreground">
          {enabled
            ? 'Se genera un cupón automático tras cada compra pagada. El % de descuento se asigna aleatoriamente dentro del rango configurado.'
            : 'Al desactivar, NO se generarán nuevos cupones. Los existentes siguen siendo válidos hasta su expiración.'}
        </p>

        <div className="flex items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="min-discount" className="text-xs font-medium">
              Mín (%)
            </Label>
            <Input
              id="min-discount"
              type="number"
              min={1}
              max={99}
              value={minPercent}
              onChange={(e) => handleMinChange(e.target.value)}
              className="w-20 font-mono"
              disabled={saving}
            />
          </div>

          <div className="flex items-center pb-2">
            <Shuffle className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="max-discount" className="text-xs font-medium">
              Máx (%)
            </Label>
            <Input
              id="max-discount"
              type="number"
              min={1}
              max={99}
              value={maxPercent}
              onChange={(e) => handleMaxChange(e.target.value)}
              className="w-20 font-mono"
              disabled={saving}
            />
          </div>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={status === 'saving'}
            variant="outline"
            className="mb-0.5"
          >
            {status === 'saving' ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Guardando</>
            ) : status === 'saved' ? (
              <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-primary" />Guardado</>
            ) : status === 'error' ? (
              <><AlertCircle className="mr-1.5 h-3.5 w-3.5 text-destructive" />Error</>
            ) : (
              'Guardar'
            )}
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Cada cupón recibe un % aleatorio dentro del rango. Actualmente: <strong>{minPercent}% — {maxPercent}%</strong>
        </p>
      </CardContent>
    </Card>
  )
}
