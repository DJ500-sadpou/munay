'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, AlertCircle, Check, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

interface BrandRow {
  id: string
  slug: string
  nombre: string
  activo: boolean
  products_count: number
}

interface Props {
  initialBrands: BrandRow[]
}

export function BrandsManager({ initialBrands }: Props) {
  const router = useRouter()
  const [brands, setBrands] = useState<BrandRow[]>(initialBrands)

  const [nombre, setNombre] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  // [FIX R3] Estado de error/loading del toggle SEPARADO del form de agregar:
  // un fallo del toggle no debe mostrar su error en el área "Agregar marca".
  const [toggleError, setToggleError] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleAdd = async () => {
    const clean = nombre.trim()
    if (clean.length < 1 || clean.length > 100) {
      setStatus('error')
      setError('El nombre debe tener entre 1 y 100 caracteres.')
      return
    }
    setStatus('loading')
    setError('')
    try {
      const res = await fetch('/api/admin/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: clean }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setError(data.error ?? 'No se pudo crear la marca.')
        return
      }
      setStatus('success')
      setNombre('')
      router.refresh()
      // Refrescar local: mantener la lista sin recargar toda la página
      setBrands((prev) => [...prev, { id: data.id, slug: data.slug, nombre: clean, activo: true, products_count: 0 }])
      setTimeout(() => setStatus('idle'), 2500)
    } catch {
      setStatus('error')
      setError('Error de conexión. Intenta nuevamente.')
    }
  }

  const handleToggle = async (id: string, activo: boolean) => {
    if (togglingId) return  // evita doble clic / carrera de PATCH
    setTogglingId(id)
    setToggleError('')
    setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, activo } : b)))
    try {
      const res = await fetch(`/api/admin/brands/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      })
      if (!res.ok) {
        // Revertir el toggle optimista
        setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, activo: !activo } : b)))
        const data = await res.json().catch(() => ({}))
        setToggleError(data.error ?? 'No se pudo actualizar la marca.')
        return
      }
      router.refresh()
    } catch {
      setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, activo: !activo } : b)))
      setToggleError('Error de conexión. Intenta nuevamente.')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Agregar marca */}
      <Card className="border-black/5 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5 text-primary" aria-hidden />
            Agregar marca
          </CardTitle>
          <CardDescription>
            Solo el nombre. El slug de la URL se genera automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="brand-nombre" className="text-xs font-medium">
                Nombre
              </Label>
              <Input
                id="brand-nombre"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value)
                  if (status === 'error' || status === 'success') setStatus('idle')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleAdd()
                  }
                }}
                disabled={status === 'loading'}
                placeholder="Ej: Nike, Adidas, Zara…"
                maxLength={100}
              />
            </div>
            <Button
              type="button"
              onClick={() => void handleAdd()}
              disabled={status === 'loading' || !nombre.trim()}
              className="mt-6 shrink-0 bg-munay-terracota text-white hover:bg-munay-terracota-quemado"
            >
              {status === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : status === 'success' ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                'Agregar'
              )}
            </Button>
          </div>

          {status === 'error' && (
            <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
              <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
              {error}
            </p>
          )}
          {status === 'success' && (
            <p className="flex items-center gap-1.5 text-xs text-primary" role="status">
              <Check className="h-3 w-3 shrink-0" aria-hidden />
              Marca agregada.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Listado */}
      {brands.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-black/10 bg-white p-12 text-center">
          <Tags className="h-10 w-10 text-munay-ink/30" aria-hidden />
          <p className="font-medium text-munay-ink">Aún no hay marcas.</p>
          <p className="text-sm text-munay-ink/60">
            Agrega la primera marca desde el formulario de arriba.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
        {toggleError && (
          <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
            {toggleError}
          </p>
        )}
        <div className="overflow-hidden rounded-lg border border-black/5 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-munay-crema/30 text-xs uppercase tracking-wider text-munay-ink/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                <th className="px-4 py-3 text-left font-medium">Slug</th>
                <th className="px-4 py-3 text-center font-medium">Productos</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-center font-medium">Activa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {brands.map((b) => (
                <tr key={b.id} className="hover:bg-munay-crema/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-munay-ink">{b.nombre}</td>
                  <td className="px-4 py-3 font-mono text-xs text-munay-ink/50">{b.slug}</td>
                  <td className="px-4 py-3 text-center text-munay-ink/70">{b.products_count}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={b.activo ? 'default' : 'outline'}>
                      {b.activo ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch
                      checked={b.activo}
                      disabled={togglingId === b.id}
                      onCheckedChange={(v) => void handleToggle(b.id, v)}
                      aria-label={`${b.activo ? 'Desactivar' : 'Activar'} marca ${b.nombre}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  )
}
