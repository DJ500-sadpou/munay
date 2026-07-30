'use client'

import { useState, useTransition } from 'react'
import { Gift, ToggleLeft, ToggleRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'

interface Props {
  initialEnabled: boolean
  initialPercent: number
}

export function LoyaltyToggle({ initialEnabled, initialPercent }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [percent, setPercent] = useState(initialPercent)
  const [saving, startSaving] = useTransition()
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const handleSave = () => {
    setStatus('saving')
    startSaving(async () => {
      try {
        const res = await fetch('/api/admin/loyalty-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled, discount_percent: percent }),
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
            <Badge variant={enabled ? 'default' : 'outline'}>{percent}%</Badge>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label="Activar cupones de fidelidad"
          />
        </div>

        <p className="text-sm text-muted-foreground">
          {enabled
            ? 'Se genera un cupón automático tras cada compra pagada. Los cupones existentes siguen siendo válidos.'
            : 'Al desactivar, NO se generarán nuevos cupones. Los existentes siguen siendo válidos hasta su expiración.'}
        </p>

        <div className="flex items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="discount" className="text-xs font-medium">
              Descuento (%)
            </Label>
            <Input
              id="discount"
              type="number"
              min={20}
              max={30}
              value={percent}
              onChange={(e) => setPercent(Math.min(30, Math.max(20, Number(e.target.value))))}
              className="w-24 font-mono"
              disabled={saving}
            />
            <p className="text-[10px] text-muted-foreground">Rango: 20% — 30%</p>
          </div>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={status === 'saving'}
            variant="outline"
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
      </CardContent>
    </Card>
  )
}
