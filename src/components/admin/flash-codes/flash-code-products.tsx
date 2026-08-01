'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Search, Loader2, AlertCircle, CheckCircle2, Package, Tag, EyeOff, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatCents } from '@/lib/format'

interface ProductItem {
  id: string
  slug: string
  title: string
  price_cents: number
  condition: string
  active: boolean
  stock: number
  precio_especial_cents?: number | null
}

interface FlashCodeInfo {
  code: string
  type: string
}

interface Props {
  flashCode: FlashCodeInfo
}

export function FlashCodeProductsManager({ flashCode }: Props) {
  const [associated, setAssociated] = useState<ProductItem[]>([])
  const [allProducts, setAllProducts] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [specialPrice, setSpecialPrice] = useState<string>('') // precio especial (USD) al asociar
  const [actionStatus, setActionStatus] = useState<{ type: 'saving' | 'saved' | 'error'; msg?: string } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/flash-codes/${flashCode.code}/products`)
      const data = await res.json()
      if (data.ok) {
        setAssociated(data.associated ?? [])
        setAllProducts(data.available ?? [])
      } else {
        setError(data.error ?? 'Error al cargar productos')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [flashCode.code])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAssociate = async (productId: string) => {
    setActionStatus({ type: 'saving' })
    try {
      // F0/BLOQUE B: precio especial opcional en USD → centavos (o null para usar price_cents)
      const trimmed = specialPrice.trim()
      const parsed = parseFloat(trimmed.replace(',', '.'))
      const precio_especial_cents =
        trimmed && Number.isFinite(parsed) && parsed >= 0
          ? Math.round(parsed * 100)
          : null
      const res = await fetch(`/api/flash-codes/${flashCode.code}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, precio_especial_cents }),
      })
      const data = await res.json()
      if (data.ok) {
        setActionStatus({ type: 'saved', msg: 'Producto asociado' })
        setSpecialPrice('')
        setTimeout(() => setActionStatus(null), 2000)
        loadData()
      } else {
        setActionStatus({ type: 'error', msg: data.error ?? 'Error' })
      }
    } catch {
      setActionStatus({ type: 'error', msg: 'Error de conexión' })
    }
  }

  const handleRemove = async (productId: string) => {
    setActionStatus({ type: 'saving' })
    try {
      const res = await fetch(`/api/flash-codes/${flashCode.code}/products?productId=${productId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.ok) {
        setActionStatus({ type: 'saved', msg: 'Producto desasociado' })
        setTimeout(() => setActionStatus(null), 2000)
        loadData()
      } else {
        setActionStatus({ type: 'error', msg: data.error ?? 'Error' })
      }
    } catch {
      setActionStatus({ type: 'error', msg: 'Error de conexión' })
    }
  }

  // Productos disponibles que NO están asociados
  const availableProducts = allProducts.filter(
    (p) => !associated.some((a) => a.id === p.id)
  )

  const filteredAvailable = availableProducts.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex items-center gap-2 py-6 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden />
          {error}
          <Button size="sm" variant="outline" className="ml-auto" onClick={loadData}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5 text-primary" aria-hidden />
          Productos asociados
        </CardTitle>
        <CardDescription>
          Este código <strong>desbloquea</strong> los productos que asocies abajo. Los productos
          ocultos (active=false) solo serán visibles a través de este código. Opcionalmente puedes
          fijar un <strong>precio especial</strong> por producto (vacío → precio de catálogo).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Productos asociados actualmente */}
        {associated.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Asociados ({associated.length})
            </p>
            <div className="space-y-1.5">
              {associated.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={p.active ? 'default' : 'outline'} className="text-[10px]">
                      {p.active ? 'Activo' : 'Oculto'}
                    </Badge>
                    {/* [F2.1] Precio y % de descuento derivado del precio especial */}
                    {p.precio_especial_cents != null && p.precio_especial_cents > 0 && p.precio_especial_cents < p.price_cents && (
                      <Badge className="bg-munay-terracota text-white text-[10px]">
                        −{Math.min(99, Math.max(0, Math.round((1 - p.precio_especial_cents / Math.max(1, p.price_cents)) * 100)))}%
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {p.precio_especial_cents != null ? `${formatCents(p.precio_especial_cents)} (especial)` : formatCents(p.price_cents)} · stock: {p.stock}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleRemove(p.id)}
                      disabled={actionStatus?.type === 'saving'}
                      aria-label={`Desasociar ${p.title}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            <Package className="mx-auto h-6 w-6 mb-2 opacity-50" aria-hidden />
            <p>Aún no hay productos asociados. Usa el buscador de abajo para agregar.</p>
          </div>
        )}

        <Separator />

        {/* Buscador y lista de productos disponibles */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="text"
                placeholder="Buscar productos para asociar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Badge variant="secondary" className="text-xs">
              {availableProducts.length} disponibles
            </Badge>
          </div>

          {/* Precio especial (USD) para el próximo producto a asociar */}
          <div className="flex items-center gap-2">
            <Label htmlFor="special-price" className="text-xs whitespace-nowrap">Precio especial (USD):</Label>
            <Input
              id="special-price"
              type="number"
              min="0"
              step="0.01"
              value={specialPrice}
              onChange={(e) => setSpecialPrice(e.target.value)}
              placeholder="opcional — ej: 15.00"
              className="h-9 max-w-[160px]"
            />
          </div>

          {search && filteredAvailable.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No se encontraron productos para <strong>"{search}"</strong>
            </p>
          ) : search ? (
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border border-border/60 p-1.5">
              {filteredAvailable.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleAssociate(p.id)}
                  disabled={actionStatus?.type === 'saving'}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent/10 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {p.active ? (
                      <ShoppingCart className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="truncate">{p.title}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{p.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatCents(p.price_cents)} · {p.stock}
                    </span>
                    <Badge variant={p.active ? 'default' : 'outline'} className="text-[10px]">
                      {p.active ? 'Activo' : 'Oculto'}
                    </Badge>
                    <Plus className="h-3.5 w-3.5 text-primary" />
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {actionStatus && (
            <p className={`flex items-center gap-1.5 text-xs ${
              actionStatus.type === 'saved' ? 'text-primary' :
              actionStatus.type === 'error' ? 'text-destructive' :
              'text-muted-foreground'
            }`}>
              {actionStatus.type === 'saving' ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Guardando…</>
              ) : actionStatus.type === 'saved' ? (
                <><CheckCircle2 className="h-3 w-3" /> {actionStatus.msg ?? 'Guardado'}</>
              ) : (
                <><AlertCircle className="h-3 w-3" /> {actionStatus.msg ?? 'Error'}</>
              )}
            </p>
          )}

          <p className="text-[10px] text-muted-foreground">
            Usa el buscador para encontrar productos. Haz click en <Plus className="inline h-2.5 w-2.5" /> para asociar.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
