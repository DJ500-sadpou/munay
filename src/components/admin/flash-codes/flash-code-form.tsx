'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, AlertCircle, ArrowLeft, Zap, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { slugify } from '@/lib/format'

interface Props {
  flashCode?: {
    code: string
    type: 'discount' | 'unlock'
    discount_percent: number | null
    discount_cents: number | null
    starts_at: string
    ends_at: string
    max_uses: number | null
    uses_count: number
    active: boolean
  }
}

export function FlashCodeForm({ flashCode }: Props) {
  const router = useRouter()
  const isEdit = !!flashCode

  const [code, setCode] = useState(flashCode?.code ?? '')
  const [type, setType] = useState<'discount' | 'unlock'>(flashCode?.type ?? 'discount')
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>(
    flashCode?.discount_percent != null ? 'percent' : flashCode?.discount_cents != null ? 'fixed' : 'percent'
  )
  const [discountValue, setDiscountValue] = useState(
    flashCode?.discount_percent != null
      ? String(flashCode.discount_percent)
      : flashCode?.discount_cents != null
      ? String(flashCode.discount_cents / 100)
      : '10'
  )
  const [startsAt, setStartsAt] = useState(
    flashCode?.starts_at
      ? new Date(flashCode.starts_at).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  )
  const [endsAt, setEndsAt] = useState(
    flashCode?.ends_at
      ? new Date(flashCode.ends_at).toISOString().slice(0, 16)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  )
  const [maxUses, setMaxUses] = useState(flashCode?.max_uses?.toString() ?? '')
  const [active, setActive] = useState(flashCode?.active ?? true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const cleanCode = code.trim().toUpperCase()
    if (cleanCode.length < 4 || cleanCode.length > 32) {
      setError('El código debe tener entre 4 y 32 caracteres.')
      setLoading(false)
      return
    }

    const payload: any = {
      code: cleanCode,
      type,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      max_uses: maxUses ? Number(maxUses) : null,
      active,
    }

    if (type === 'discount') {
      const v = Number(discountValue)
      if (isNaN(v) || v <= 0) {
        setError('Valor de descuento inválido.')
        setLoading(false)
        return
      }
      if (discountType === 'percent') {
        if (v < 0 || v > 100) {
          setError('El porcentaje debe estar entre 0 y 100.')
          setLoading(false)
          return
        }
        payload.discount_percent = v
        payload.discount_cents = null
      } else {
        payload.discount_cents = Math.round(v * 100)
        payload.discount_percent = null
      }
    } else {
      payload.discount_percent = null
      payload.discount_cents = null
    }

    if (new Date(payload.ends_at) <= new Date(payload.starts_at)) {
      setError('La fecha de fin debe ser posterior a la de inicio.')
      setLoading(false)
      return
    }

    try {
      const url = isEdit ? `/api/flash-codes/${flashCode!.code}` : '/api/flash-codes'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al guardar.')
        setLoading(false)
        return
      }
      router.push('/admin/flash-codes')
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? 'Error de conexión.')
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin/flash-codes">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Volver a flash codes
        </Link>
      </Button>

      <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
        {isEdit ? 'Editar código flash' : 'Nuevo código flash'}
      </h1>
      <p className="text-muted-foreground mb-8">
        Configura descuentos o desbloquea piezas exclusivas.
      </p>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Configuración</CardTitle>
          <CardDescription>
            Los campos marcados con * son obligatorios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                required
                maxLength={32}
                minLength={4}
                className="font-mono uppercase tracking-widest"
                placeholder="MUNAY10"
                disabled={isEdit}
              />
              <p className="text-xs text-muted-foreground">
                Solo letras mayúsculas y números. 4-32 caracteres.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo *</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'discount' | 'unlock')}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discount">
                    <span className="flex items-center gap-2">
                      <Zap className="h-3 w-3" />
                      Descuento (en todo el catálogo)
                    </span>
                  </SelectItem>
                  <SelectItem value="unlock">
                    <span className="flex items-center gap-2">
                      <Plus className="h-3 w-3" />
                      Desbloqueo (pieza oculta)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type === 'discount' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="discount-type">Tipo de descuento</Label>
                  <Select
                    value={discountType}
                    onValueChange={(v) => setDiscountType(v as 'percent' | 'fixed')}
                  >
                    <SelectTrigger id="discount-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Porcentaje (%)</SelectItem>
                      <SelectItem value="fixed">Monto fijo (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount-value">
                    {discountType === 'percent' ? 'Porcentaje *' : 'Monto USD *'}
                  </Label>
                  <Input
                    id="discount-value"
                    type="number"
                    step={discountType === 'percent' ? '1' : '0.01'}
                    min="0"
                    max={discountType === 'percent' ? '100' : undefined}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="starts-at">Inicio *</Label>
                <Input
                  id="starts-at"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ends-at">Fin *</Label>
                <Input
                  id="ends-at"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-uses">Usos máximos (vacío = ilimitado)</Label>
              <Input
                id="max-uses"
                type="number"
                min="1"
                step="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="100"
              />
              {isEdit && flashCode && (
                <p className="text-xs text-muted-foreground">
                  Usos actuales: <strong>{flashCode.uses_count}</strong>
                  {flashCode.max_uses && ` / ${flashCode.max_uses}`}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
              <div>
                <Label htmlFor="active" className="font-medium">Activo</Label>
                <p className="text-xs text-muted-foreground">
                  Desactiva para pausar sin borrar.
                </p>
              </div>
              <Switch id="active" checked={active} onCheckedChange={setActive} />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Guardando…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" aria-hidden />
                    {isEdit ? 'Guardar cambios' : 'Crear código'}
                  </>
                )}
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/flash-codes">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
