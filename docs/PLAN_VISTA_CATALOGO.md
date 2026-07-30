# Plan: Vista Rápida / Detallada en el Catálogo

## Objetivo
Añadir un toggle switch en la página `/catalogo` que permita cambiar entre:
- **Vista rápida** (default): Cards compactas actuales (imagen, título, estado, precio, botones)
- **Vista detallada**: Cards más amplias que incluyen la **descripción** del producto

El toggle debe ser rojo (`munay-red-600`) cuando está activo (detallada) y gris cuando está en rápida.

---

## Fase 1: Preparación de datos

### 1.1 Asegurar que `description` se incluya en `listProducts()`

**Archivo**: `src/lib/queries/products.ts`

- Verificar que la query `listProducts()` incluya `p.description` en el SELECT
- Si ya está incluida pero no se pasa al `ProductCard`, agregarla al `ProductCardData`

### 1.2 Añadir `description` a `ProductCardData`

**Archivo**: `src/components/product/product-card.tsx`

```typescript
export interface ProductCardData {
  // ... existing fields
  description?: string | null  // ← nueva
}
```

### 1.3 Pasar `description` desde catálogo a ProductCard

**Archivo**: `src/app/catalogo/page.tsx`

```typescript
<ProductCard
  product={{
    // ... existing passthrough
    description: p.description,  // ← nuevo
  }}
/>
```

---

## Fase 2: Componente Toggle Switch

### 2.1 Crear `CatalogViewToggle`

**Archivo nuevo**: `src/components/catalogo/catalog-view-toggle.tsx`

```tsx
'use client'

interface Props {
  view: 'quick' | 'detailed'
  onChange: (view: 'quick' | 'detailed') => void
}

export function CatalogViewToggle({ view, onChange }: Props) {
  const isDetailed = view === 'detailed'
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-munay-ink/60">Rápida</span>
      <button
        type="button"
        role="switch"
        aria-checked={isDetailed}
        aria-label="Cambiar vista del catálogo"
        onClick={() => onChange(isDetailed ? 'quick' : 'detailed')}
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          isDetailed ? "bg-munay-red-600" : "bg-gray-300"
        )}
      >
        <span className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
          isDetailed ? "translate-x-[18px]" : "translate-x-[3px]"
        )} />
      </button>
      <span className="text-xs font-medium text-munay-ink">Detallada</span>
    </div>
  )
}
```

**Consideraciones de diseño**:
- Switch inline con labels "Rápida" / "Detallada"
- Color rojo marca cuando está en detallada, gris (`bg-gray-300`) cuando está en rápida
- `aria-checked` y `role="switch"` para accesibilidad
- Animación suave con `transition-colors` y `transition-transform`

### 2.2 Persistencia del estado

**Dos opciones**:

**Opción A — localStorage (recomendada)**:
- Guardar preferencia en `localStorage.setItem('munay-catalog-view', 'quick' | 'detailed')`
- Leer al montar el componente
- No afecta la URL, no requiere recarga del servidor

**Opción B — URL search param**:
- Usar `?view=quick` o `?view=detailed` en la URL
- Permite compartir enlaces con la vista específica
- Más complejo porque requiere manejar searchParams en server component

**Recomendación**: Opción A (localStorage) por simplicidad. La vista no es crítica para SEO ni para compartir enlaces.

---

## Fase 3: Componente ProductCardDetailed

### 3.1 Crear `ProductCardDetailed`

**Archivo nuevo**: `src/components/product/product-card-detailed.tsx`

Componente similar a `ProductCard` pero con descripción visible:

```tsx
export function ProductCardDetailed({ product }: { product: ProductCardData }) {
  // Misma lógica que ProductCard (carrito, flash discounts, etc.)
  // Pero el layout es diferente:

  return (
    <Card className="flex flex-row overflow-hidden ... gap-0 py-0">
      {/* Imagen — más pequeña, a la izquierda */}
      <Link href={...} className="relative w-28 shrink-0 sm:w-36 aspect-square">
        {image ? <Image ... /> : <ImageOff ... />}
      </Link>

      {/* Info — a la derecha, ocupa el resto */}
      <div className="flex flex-1 flex-col px-3 py-2">
        {/* Título */}
        <Link className="font-medium ...">{title}</Link>
        
        {/* Estado */}
        {grading && <p className="mt-0.5 text-xs ...">{GRADING_LABEL[grading]}</p>}

        {/* DESCRIPCIÓN — line-clamp-2 */}
        {product.description && (
          <p className="mt-1 text-xs text-munay-ink/60 line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Precio */}
        <div className="mt-auto flex items-baseline gap-1.5 pt-1">
          {flash && <span className="line-through ...">{original}</span>}
          <span className="font-semibold ...">{finalPrice}</span>
        </div>

        {/* Botones */}
        <div className="flex gap-1.5 mt-1">
          <Button size="sm" variant="outline">Ver</Button>
          <Button size="sm" className="bg-munay-red-600">Agregar</Button>
        </div>
      </div>
    </Card>
  )
}
```

**Layout**: Horizontal (imagen a la izquierda, info a la derecha) para aprovechar el espacio extra de la descripción.

### 3.2 Actualizar grid del catálogo para vista detallada

**Archivo**: `src/app/catalogo/page.tsx`

- Cuando `view === 'detailed'`, cambiar grid de `grid-cols-2 sm:grid-cols-3` → `grid-cols-1 sm:grid-cols-2`
- Las cards son más anchas en horizontal, necesitan más espacio

---

## Fase 4: Integración en el Catálogo

### 4.1 Actualizar catálogo page

**Archivo**: `src/app/catalogo/page.tsx`

Convertir a **Client Component** (o crear wrapper client) porque necesita estado interactivo.

**Opción A**: Convertir toda la página a client → ⚠️ Mucho trabajo, pierde SSR
**Opción B**: Crear un wrapper client `CatalogPageClient` que maneja el estado

**Recomendación**: Opción B — estructura limpia:

```tsx
// src/components/catalogo/catalog-page-client.tsx
'use client'

export function CatalogPageClient({ products }: { products: ProductCardData[] }) {
  const [view, setView] = useState<'quick' | 'detailed'>('quick')

  useEffect(() => {
    const saved = localStorage.getItem('munay-catalog-view')
    if (saved === 'quick' || saved === 'detailed') setView(saved)
  }, [])

  const handleViewChange = (newView: 'quick' | 'detailed') => {
    setView(newView)
    localStorage.setItem('munay-catalog-view', newView)
  }

  return (
    <>
      <CatalogViewToggle view={view} onChange={handleViewChange} />
      
      <div className={view === 'quick' 
        ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4"
        : "grid grid-cols-1 gap-3 sm:grid-cols-2"
      }>
        {products.map(p => view === 'quick' 
          ? <ProductCard key={p.id} product={p} />
          : <ProductCardDetailed key={p.id} product={p} />
        )}
      </div>
    </>
  )
}
```

### 4.2 Insertar toggle en el layout del catálogo

**Ubicación**: Entre el buscador/filtros y la grilla de productos, al lado derecho.

```
[Buscador]          [Tengo código flash]  [Rápida |🟢| Detallada]
```

---

## Fase 5: Toques finales

### 5.1 Posición del toggle
- Alineado a la derecha del header del catálogo
- Visible solo en desktop (> sm) o también en mobile

### 5.2 Animaciones
- Transición suave al cambiar de vista (opcional)
- Los badges (flash, condición) se mantienen igual en ambas vistas

### 5.3 Responsive
- Vista detallada: en mobile (< sm), la card horizontal se vuelve vertical (imagen arriba, texto abajo)
- Usar `flex-col sm:flex-row` en la card detallada

---

## Resumen de archivos a modificar/crear

| Archivo | Acción |
|:---|---:|
| `src/components/catalogo/catalog-view-toggle.tsx` | **NUEVO** — Toggle switch rojo/gris |
| `src/components/product/product-card-detailed.tsx` | **NUEVO** — Card con descripción visible |
| `src/components/catalogo/catalog-page-client.tsx` | **NUEVO** — Wrapper client para estado |
| `src/app/catalogo/page.tsx` | **MODIFICAR** — Pasar description, integrar toggle |
| `src/components/product/product-card.tsx` | **MODIFICAR** — Añadir description a ProductCardData |
| `src/lib/queries/products.ts` | **VERIFICAR** — description en SELECT |

## Orden de implementación

1. Fase 1: Preparar datos (ProductCardData + query)
2. Fase 2: CatalogViewToggle (switch componente)
3. Fase 3: ProductCardDetailed (nueva card)
4. Fase 4: Integración en catálogo (wrapper client)
5. Fase 5: Polish (responsive, animaciones)
