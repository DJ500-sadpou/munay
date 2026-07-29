'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { slugify } from '@/lib/format'
import { ROUTES } from '@/lib/constants'

interface Props {
  /** Si se pasa, es edición. Si no, es creación. */
  product?: {
    id: string
    slug: string
    title: string
    description: string | null
    price_cents: number
    condition: 'new' | 'used'
    grading: 'excelente' | 'buena' | 'regular' | null
    active: boolean
    stock: number
  }
}

export function ProductForm({ product }: Props) {
  const router = useRouter()
  const isEdit = !!product

  const [title, setTitle] = useState(product?.title ?? '')
  const [slug, setSlug] = useState(product?.slug ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price, setPrice] = useState(product ? String(product.price_cents / 100) : '')
  const [condition, setCondition] = useState<'new' | 'used'>(product?.condition ?? 'new')
  const [grading, setGrading] = useState<'excelente' | 'buena' | 'regular' | 'none'>(
    product?.grading ?? 'none'
  )
  const [stock, setStock] = useState(product ? String(product.stock) : '0')
  const [active, setActive] = useState(product?.active ?? true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-generar slug al escribir título (solo en modo creación)
  const handleTitleChange = (v: string) => {
    setTitle(v)
    if (!isEdit) setSlug(slugify(v))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const priceCents = Math.round(Number(price) * 100)
    if (isNaN(priceCents) || priceCents < 0) {
      setError('Precio inválido.')
      setLoading(false)
      return
    }
    const stockNum = Number(stock)
    if (isNaN(stockNum) || stockNum < 0) {
      setError('Stock inválido.')
      setLoading(false)
      return
    }

    const payload = {
      slug: slug.trim(),
      title: title.trim(),
      description: description.trim() || null,
      price_cents: priceCents,
      condition,
      grading: grading === 'none' ? null : grading,
      active,
      stock: stockNum,
    }

    try {
      const url = isEdit ? `/api/admin/products/${product!.id}` : '/api/admin/products'
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
      router.push('/admin')
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? 'Error de conexión.')
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Volver al panel
        </Link>
      </Button>

      <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
        {isEdit ? 'Editar producto' : 'Nuevo producto'}
      </h1>
      <p className="text-muted-foreground mb-8">
        Los cambios se guardan en Supabase. La creación usa service role (bypass RLS).
      </p>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Detalles del producto</CardTitle>
          <CardDescription>
            Los campos marcados con * son obligatorios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                required
                maxLength={200}
                placeholder="Ej: Camiseta de algodón orgánico — talla M"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL) *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                required
                maxLength={120}
                className="font-mono"
                placeholder="camiseta-algodon-organico"
              />
              <p className="text-xs text-muted-foreground">
                Se usará en la URL: <code>/p/{`{slug}`}</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Origen, dimensiones, condición, historia…"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">Precio (USD) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  placeholder="18.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  step="1"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="condition">Condición *</Label>
                <Select value={condition} onValueChange={(v) => setCondition(v as 'new' | 'used')}>
                  <SelectTrigger id="condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Nuevo</SelectItem>
                    <SelectItem value="used">Usado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="grading">Estado (solo usadas)</Label>
                <Select
                  value={grading}
                  onValueChange={(v) => setGrading(v as 'excelente' | 'buena' | 'regular' | 'none')}
                >
                  <SelectTrigger id="grading">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sin estado —</SelectItem>
                    <SelectItem value="excelente">Excelente</SelectItem>
                    <SelectItem value="buena">Bueno</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
              <div>
                <Label htmlFor="active" className="font-medium">Activo (visible en catálogo)</Label>
                <p className="text-xs text-muted-foreground">
                  Desactiva para ocultar sin borrar.
                </p>
              </div>
              <Switch
                id="active"
                checked={active}
                onCheckedChange={setActive}
              />
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
                    {isEdit ? 'Guardar cambios' : 'Crear producto'}
                  </>
                )}
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
