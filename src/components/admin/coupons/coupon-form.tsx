'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, AlertCircle, ArrowLeft, Ticket, Sparkles, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SETTINGS_DEFAULTS } from '@/lib/constants'

interface CouponFormData {
  codigo: string
  tipo: 'general' | 'primera_compra'
  porcentaje_descuento: number
  /** Monto mínimo EN CENTAVOS (la página lo entrega así; el form lo divide /100 para mostrar USD). */
  monto_minimo_compra: number
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
  usos_maximos: number | null
  /** [FIX Ronda 1] Solo lectura informativa en edición (usos actuales). */
  usos_actuales?: number
}

interface Props {
  coupon?: CouponFormData & { id: string }
  /** [F1.1] Umbral configurable de advertencia para primera_compra (default 30). */
  warningThreshold?: number
}

/**
 * [F1.1] Autogenera un código sugerido SOLO alfanumérico (las regex de
 * looksLikeFlashCode NO aceptan guiones): MUNAY + 4 caracteres A-Z0-9.
 */
function generateCodeSuggestion(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let suffix = ''
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  return `MUNAY${suffix}`
}

// [FIX Ronda 1] Default desde SETTINGS_DEFAULTS (constants.ts), no literal
// hardcodeado — una sola fuente de verdad para el fallback.
export function CouponForm({
  coupon,
  warningThreshold = SETTINGS_DEFAULTS.coupon_first_purchase_warning_threshold,
}: Props) {
  const router = useRouter()
  const isEdit = !!coupon

  const [codigo, setCodigo] = useState(coupon?.codigo ?? '')
  const [tipo, setTipo] = useState<'general' | 'primera_compra'>(coupon?.tipo ?? 'general')
  const [porcentaje, setPorcentaje] = useState(coupon?.porcentaje_descuento?.toString() ?? '10')
  const [montoMinimo, setMontoMinimo] = useState(
    coupon ? (coupon.monto_minimo_compra / 100).toString() : '20'
  )
  const [fechaInicio, setFechaInicio] = useState(
    coupon?.fecha_inicio
      ? new Date(coupon.fecha_inicio).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  )
  const [fechaFin, setFechaFin] = useState(
    coupon?.fecha_fin
      ? new Date(coupon.fecha_fin).toISOString().slice(0, 16)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  )
  const [maxUses, setMaxUses] = useState(coupon?.usos_maximos?.toString() ?? '')
  const [activo, setActivo] = useState(coupon?.activo ?? true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const cleanCodigo = codigo.trim().toUpperCase()
    if (cleanCodigo.length < 4 || cleanCodigo.length > 32) {
      setError('El código debe tener entre 4 y 32 caracteres.')
      setLoading(false)
      return
    }
    if (!/^[A-Z0-9]+$/.test(cleanCodigo)) {
      setError('Solo letras mayúsculas y números.')
      setLoading(false)
      return
    }
    const pct = Number(porcentaje)
    if (isNaN(pct) || pct < 1 || pct > 100) {
      setError('El porcentaje debe estar entre 1 y 100.')
      setLoading(false)
      return
    }
    const minUsd = Number(montoMinimo)
    if (isNaN(minUsd) || minUsd < 0) {
      setError('Monto mínimo inválido.')
      setLoading(false)
      return
    }

    const payload: any = {
      codigo: cleanCodigo,
      tipo,
      porcentaje_descuento: Math.round(pct),
      // [FIX F2] Se envía en USD; la API convierte a centavos.
      monto_minimo_compra: minUsd,
      fecha_inicio: new Date(fechaInicio).toISOString(),
      fecha_fin: new Date(fechaFin).toISOString(),
      activo,
      usos_maximos: maxUses ? Number(maxUses) : null,
    }

    if (new Date(payload.fecha_fin) <= new Date(payload.fecha_inicio)) {
      setError('La fecha de fin debe ser posterior a la de inicio.')
      setLoading(false)
      return
    }

    try {
      const url = isEdit ? `/api/admin/coupons/${coupon!.id}` : '/api/admin/coupons'
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
      router.push('/admin/coupons')
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? 'Error de conexión.')
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin/coupons">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Volver a cupones
        </Link>
      </Button>

      <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
        {isEdit ? 'Editar cupón' : 'Nuevo cupón'}
      </h1>
      <p className="text-muted-foreground mb-8">
        Descuento porcentual aplicable en el checkout. Sistema independiente de los códigos flash.
      </p>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Ticket className="h-5 w-5" aria-hidden />
            Configuración
          </CardTitle>
          <CardDescription>Los campos marcados con * son obligatorios.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código *</Label>
              {/* [FIX Ronda 1] Input + botón "Generar" en línea (junto al campo) */}
              <div className="flex gap-2">
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  required
                  maxLength={32}
                  minLength={4}
                  className="flex-1 font-mono uppercase tracking-widest"
                  placeholder="MUNAY25"
                  disabled={isEdit}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isEdit}
                  onClick={() => setCodigo(generateCodeSuggestion())}
                  className="shrink-0"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Generar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Solo letras mayúsculas y números. 4-32 caracteres.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as 'general' | 'primera_compra')}>
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General (toda la tienda)</SelectItem>
                  <SelectItem value="primera_compra">Primera compra</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {tipo === 'primera_compra'
                  ? 'Solo aplica si el usuario no tiene órdenes pagadas previas.'
                  : 'Aplica a cualquier compra que cumpla el monto mínimo.'}
              </p>

              {/* [F1.1] Advertencia NO bloqueante para primera_compra con % alto
                  [FIX Ronda 1] role="status" + aria-live para screen readers. */}
              {tipo === 'primera_compra' && Number(porcentaje) > warningThreshold && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                  <span>
                    Un descuento alto en cupones de primera compra puede generar pérdida si no
                    está calibrado contra tu margen. Verifica antes de activar.
                  </span>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="porcentaje">Descuento (%) *</Label>
                <Input
                  id="porcentaje"
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  value={porcentaje}
                  onChange={(e) => setPorcentaje(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monto-minimo">Monto mínimo (USD)</Label>
                <Input
                  id="monto-minimo"
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoMinimo}
                  onChange={(e) => setMontoMinimo(e.target.value)}
                  placeholder="20"
                />
                <p className="text-xs text-muted-foreground">Subtotal mínimo para poder aplicar el cupón.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fecha-inicio">Inicio *</Label>
                <Input
                  id="fecha-inicio"
                  type="datetime-local"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha-fin">Fin *</Label>
                <Input
                  id="fecha-fin"
                  type="datetime-local"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
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
              {isEdit && coupon && typeof coupon.usos_actuales === 'number' && (
                <p className="text-xs text-muted-foreground">
                  Usos actuales: <strong>{coupon.usos_actuales}</strong>
                  {coupon.usos_maximos !== null ? ` / ${coupon.usos_maximos}` : ''}
                  {coupon.usos_maximos !== null && coupon.usos_actuales >= coupon.usos_maximos
                    ? ' (agotado)'
                    : ''}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
              <div>
                <Label htmlFor="activo" className="font-medium">Activo</Label>
                <p className="text-xs text-muted-foreground">Desactiva para pausar sin borrar.</p>
              </div>
              <Switch id="activo" checked={activo} onCheckedChange={setActivo} />
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
                    {isEdit ? 'Guardar cambios' : 'Crear cupón'}
                  </>
                )}
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/coupons">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
