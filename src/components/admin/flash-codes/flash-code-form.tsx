'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, AlertCircle, ArrowLeft, Unlock, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface Props {
  flashCode?: {
    code: string
    type: 'unlock'
    starts_at: string
    ends_at: string
    max_uses: number | null
    uses_count: number
    active: boolean
  }
}

/**
 * [F2.1] Autogenera un código sugerido SOLO alfanumérico (las regex de
 * looksLikeFlashCode / /^[A-Z0-9]+$/ NO aceptan guiones): MUNAY + 4 A-Z0-9.
 * Mismo patrón que F1.1 en coupon-form.tsx.
 */
function generateCodeSuggestion(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let suffix = ''
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  return `MUNAY${suffix}`
}

export function FlashCodeForm({ flashCode }: Props) {
  const router = useRouter()
  const isEdit = !!flashCode
  // [F2 + F0/BLOQUE B] Los códigos flash son SOLO de tipo 'unlock' (desbloqueo de
  // productos). Los descuentos generales viven en el módulo de Cupones (/admin/coupons).
  // Las columnas discount_percent/discount_cents ya no existen en flash_codes.

  const [code, setCode] = useState(flashCode?.code ?? '')
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
    if (!/^[A-Z0-9]+$/.test(cleanCode)) {
      setError('Solo letras mayúsculas y números.')
      setLoading(false)
      return
    }

    const payload: any = {
      code: cleanCode,
      type: 'unlock', // [F2 + F0] fijo: desbloqueo. Descuentos → /admin/coupons.
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      max_uses: maxUses ? Number(maxUses) : null,
      active,
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
      // [P1] Tras CREAR, ir directo a la página de edición del código recién
      // creado para asociar los productos / mini-colección que desbloquea
      // (el gestor de productos vive en /admin/flash-codes/[code]). Antes
      // volvía al listado y el admin no encontraba cómo asociar productos.
      if (isEdit) {
        router.push('/admin/flash-codes')
      } else {
        router.push(`/admin/flash-codes/${cleanCode}`)
      }
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
        Desbloquea piezas exclusivas ocultas en el catálogo. Los descuentos generales se gestionan en{' '}
        <Link href="/admin/coupons" className="underline text-primary">Cupones</Link>.
      </p>

      {/* [F0/BLOQUE B] Ya no hay códigos 'discount' legacy — los descuentos se
          gestionan exclusivamente en /admin/coupons. */}

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Unlock className="h-5 w-5" aria-hidden />
            Configuración
          </CardTitle>
          <CardDescription>
            Los campos marcados con * son obligatorios. Tras crear el código
            podrás asociar los productos (o mini-colección) que desbloquea.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              {/* [F2.1] Input + botón "Generar" en línea (autogenerar editable) */}
              <div className="flex gap-2">
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
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
                  onClick={() => setCode(generateCodeSuggestion())}
                  className="shrink-0"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Generar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Solo letras mayúsculas y números. 4-32 caracteres. Se escribe en la barra de búsqueda del catálogo.
              </p>
            </div>

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
