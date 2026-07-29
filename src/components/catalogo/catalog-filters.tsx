/**
 * Panel de filtros laterales para el catálogo.
 *
 * Todos los filtros viven en la URL (search params) para que sean
 * compartibles y navegables con back/forward.
 *
 * Server Component — recibe los filtros actuales y renderiza los controles.
 * Los controles son un `<form method="GET">` que actualiza la URL.
 */

import Link from 'next/link'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProductFilters } from '@/lib/queries/products'

interface Props {
  filters: ProductFilters
  totalCount: number
  flashCodeActive?: string | null
}

export function CatalogFilters({ filters, totalCount, flashCodeActive }: Props) {
  // Construir href con los filtros preservando los demás
  const buildHref = (updates: Partial<ProductFilters>): string => {
    const merged: ProductFilters = { ...filters, ...updates }
    const params = new URLSearchParams()
    if (merged.q) params.set('q', merged.q)
    if (merged.condition && merged.condition !== 'all') params.set('condition', merged.condition)
    if (merged.grading && merged.grading !== 'all') params.set('grading', merged.grading)
    if (merged.minPriceCents !== undefined) params.set('minPrice', String(merged.minPriceCents / 100))
    if (merged.maxPriceCents !== undefined) params.set('maxPrice', String(merged.maxPriceCents / 100))
    if (merged.sort && merged.sort !== 'recent') params.set('sort', merged.sort)
    if (merged.flashCode) params.set('flash', merged.flashCode)
    const qs = params.toString()
    return qs ? `/catalogo?${qs}` : '/catalogo'
  }

  return (
    <aside className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Filtros
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {totalCount} {totalCount === 1 ? 'pieza' : 'piezas'} encontradas
        </p>
      </div>

      {/* Orden */}
      <div className="space-y-2">
        <Label htmlFor="sort" className="text-xs font-medium">Ordenar por</Label>
        <Select name="sort" defaultValue={filters.sort ?? 'recent'}>
          <SelectTrigger id="sort" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Más recientes</SelectItem>
            <SelectItem value="price_asc">Precio: menor a mayor</SelectItem>
            <SelectItem value="price_desc">Precio: mayor a menor</SelectItem>
            <SelectItem value="title_asc">Título: A → Z</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          Los enlaces siguientes preservan el orden.
        </p>
      </div>

      {/* Condición */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Condición</Label>
        <div className="flex flex-col gap-1">
          {(['all', 'new', 'used'] as const).map((c) => {
            const label = c === 'all' ? 'Todas' : c === 'new' ? 'Nuevas' : 'Usadas'
            const isActive = (filters.condition ?? 'all') === c
            return (
              <Link
                key={c}
                href={buildHref({ condition: c })}
                className={`flex items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground/80 hover:bg-muted'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Grading (solo aplica a piezas usadas) */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Estado (usadas)</Label>
        <div className="flex flex-col gap-1">
          {(['all', 'excelente', 'buena', 'regular'] as const).map((g) => {
            const labels: Record<string, string> = {
              all: 'Todos',
              excelente: 'Excelente',
              buena: 'Bueno',
              regular: 'Regular',
            }
            const isActive = (filters.grading ?? 'all') === g
            return (
              <Link
                key={g}
                href={buildHref({ grading: g })}
                className={`flex items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground/80 hover:bg-muted'
                }`}
              >
                {labels[g]}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Rango de precio */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Rango de precio (USD)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="Mín"
            defaultValue={filters.minPriceCents !== undefined ? filters.minPriceCents / 100 : ''}
            className="h-9"
            name="minPrice"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="Máx"
            defaultValue={filters.maxPriceCents !== undefined ? filters.maxPriceCents / 100 : ''}
            className="h-9"
            name="maxPrice"
          />
        </div>
        <Button asChild variant="outline" size="sm" className="w-full mt-2">
          <Link href={buildHref({})}>Aplicar rango</Link>
        </Button>
      </div>

      {/* Código flash activo */}
      {flashCodeActive && (
        <div className="rounded-md border border-accent/40 bg-accent/10 p-3">
          <p className="text-xs font-medium text-accent-foreground">Código flash activo</p>
          <p className="mt-1 font-mono text-lg font-bold text-accent">{flashCodeActive}</p>
          <Button asChild variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs">
            <Link href={buildHref({ flashCode: undefined })}>
              <RotateCcw className="mr-1 h-3 w-3" aria-hidden />
              Quitar descuento
            </Link>
          </Button>
        </div>
      )}

      {/* Limpiar filtros */}
      <Button asChild variant="ghost" size="sm" className="w-full">
        <Link href="/catalogo">
          <RotateCcw className="mr-2 h-3.5 w-3.5" aria-hidden />
          Limpiar filtros
        </Link>
      </Button>
    </aside>
  )
}
