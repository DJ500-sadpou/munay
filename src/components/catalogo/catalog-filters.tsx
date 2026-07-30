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
import { RotateCcw, Zap } from 'lucide-react'
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
      {/* Header del panel */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Filtros
        </h2>
        <span className="rounded-full bg-primary/5 px-2.5 py-0.5 text-[11px] font-medium text-primary">
          {totalCount}
        </span>
      </div>
      <div className="h-px bg-gradient-to-r from-border/60 to-transparent" />

      {/* Orden */}
      <div className="space-y-2">
        <Label htmlFor="sort" className="text-xs font-medium text-foreground/70">Ordenar por</Label>
        <Select name="sort" defaultValue={filters.sort ?? 'recent'}>
          <SelectTrigger id="sort" className="h-9 border-border/60 transition-colors hover:border-primary/40 focus:ring-primary/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Más recientes</SelectItem>
            <SelectItem value="price_asc">Precio: menor a mayor</SelectItem>
            <SelectItem value="price_desc">Precio: mayor a menor</SelectItem>
            <SelectItem value="title_asc">Título: A → Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Condición */}
      <div className="space-y-2.5">
        <Label className="text-xs font-medium text-foreground/70">Condición</Label>
        <div className="flex flex-col gap-1">
          {(['all', 'new', 'used'] as const).map((c) => {
            const label = c === 'all' ? 'Todas' : c === 'new' ? 'Nuevas' : 'Usadas'
            const isActive = (filters.condition ?? 'all') === c
            return (
              <Link
                key={c}
                href={buildHref({ condition: c })}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium shadow-sm'
                    : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                }`}
              >
                {label}
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Grading (solo aplica a piezas usadas) */}
      <div className="space-y-2.5">
        <Label className="text-xs font-medium text-foreground/70">Estado (usadas)</Label>
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
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium shadow-sm'
                    : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                }`}
              >
                {labels[g]}
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Rango de precio */}
      <div className="space-y-2.5">
        <Label className="text-xs font-medium text-foreground/70">Rango de precio (USD)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="Mín"
            defaultValue={filters.minPriceCents !== undefined ? filters.minPriceCents / 100 : ''}
            className="h-9 border-border/60 transition-colors focus:border-primary/40"
            name="minPrice"
          />
          <span className="text-muted-foreground/60">—</span>
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="Máx"
            defaultValue={filters.maxPriceCents !== undefined ? filters.maxPriceCents / 100 : ''}
            className="h-9 border-border/60 transition-colors focus:border-primary/40"
            name="maxPrice"
          />
        </div>
        <Button asChild variant="outline" size="sm" className="w-full transition-all duration-200 hover:border-primary/30 hover:bg-primary/5">
          <Link href={buildHref({})}>Aplicar rango</Link>
        </Button>
      </div>

      {/* Código flash activo */}
      {flashCodeActive && (
        <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 to-accent/5 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20">
              <Zap className="h-3 w-3 text-accent" aria-hidden />
            </span>
            <p className="text-xs font-medium text-accent-foreground/80">Código flash activo</p>
          </div>
          <p className="mt-2 font-mono text-xl font-bold tracking-wider text-accent">{flashCodeActive}</p>
          <Button asChild variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs text-accent hover:text-accent/80 hover:bg-accent/10">
            <Link href={buildHref({ flashCode: undefined })}>
              <RotateCcw className="mr-1 h-3 w-3" aria-hidden />
              Quitar descuento
            </Link>
          </Button>
        </div>
      )}

      {/* Limpiar filtros */}
      <Button asChild variant="ghost" size="sm" className="w-full text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-muted/80">
        <Link href="/catalogo">
          <RotateCcw className="mr-2 h-3.5 w-3.5" aria-hidden />
          Limpiar filtros
        </Link>
      </Button>
    </aside>
  )
}
