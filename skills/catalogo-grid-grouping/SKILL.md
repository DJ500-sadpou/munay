---
name: catalogo-grid-grouping
description: Patrón para agrupar ítems de un grid por una propiedad (condition, category, etc.) en secciones separadas para mantener alturas consistentes.
category: reference
tags: [ui, grid, layout, grouping, catalog]
---

# catalogo-grid-grouping

> **Origin:** `captured` — Observado durante implementación de agrupado por condición en catálogo MUNAY.
> **Problema original:** Cards de productos usados tenían más contenido (grading text) que cards de productos nuevos, rompiendo la alineación del grid CSS.

## Propósito

Cuando un grid CSS contiene ítems con contenido de **altura variable**, el `grid-auto-rows` hace que todas las cards de una fila midan lo mismo (la altura de la más alta). Si las alturas varían mucho entre filas, el layout se ve desordenado.

**Solución:** Separar los ítems en grids independientes agrupados por la propiedad que causa la variación de altura.

## Cuándo usar

- Tienes un grid de cards con contenido de **altura inconsistente**
- La inconsistencia se debe a una **propiedad agrupable** (condición, categoría, tipo, etc.)
- Quieres que todas las cards **dentro de cada grupo** tengan la misma altura

## Precondiciones

- Los datos tienen una propiedad discreta para agrupar (`condition: 'new' | 'used'`)
- El grid usa CSS Grid (no Flexbox) para el layout responsivo

## Procedimiento

### Paso 1: Identificar la propiedad de agrupación

Determinar qué propiedad del ítem causa la diferencia de altura:

```tsx
// Ejemplo: productos con grading text solo en 'used'
const newItems = items.filter(i => i.condition === 'new')
const usedItems = items.filter(i => i.condition === 'used')
```

### Paso 2: Mover el filtrado fuera del JSX

En un Server Component, las variables se declaran antes del `return`:

```tsx
// ✅ Correcto: fuera del JSX
const groupA = items.filter(i => i.type === 'a')
const groupB = items.filter(i => i.type === 'b')

return (
  <div className="space-y-8">
    {groupA.length > 0 && (
      <section>
        <h2>Tipo A ({groupA.length})</h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {groupA.map(item => <Card key={item.id} />)}
        </div>
      </section>
    )}
    {groupB.length > 0 && (
      <section>
        <h2>Tipo B ({groupB.length})</h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {groupB.map(item => <Card key={item.id} />)}
        </div>
      </section>
    )}
  </div>
)
```

### Paso 3: Usar las mismas clases de grid

Cada grupo usa las MISMAS clases responsive:

| Dispositivo | Columnas | Clase |
|---|---|---|
| Mobile | 2 | `grid-cols-2` |
| Tablet | 3 | `sm:grid-cols-3` |
| Desktop | 4 | `xl:grid-cols-4` |

### Paso 4: Agregar separación visual

Usar `space-y-8` en el contenedor y encabezados sutiles:

```tsx
<div className="space-y-8">
  <section>
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-munay-ink/40">
      Nuevos
      <span className="ml-2 font-normal normal-case text-munay-ink/30">({count})</span>
    </h2>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {/* cards */}
    </div>
  </section>
</div>
```

## Validación

1. Las cards dentro de cada grupo tienen la misma altura visual
2. Los grupos se renderizan en orden (nuevos primero, usados segundo)
3. Mobile muestra 2 columnas, desktop 4 columnas
4. Si un grupo está vacío, no se renderiza (sin error)

## Limitaciones

- No sirve para ordenamiento mixto (nuevos y usados mezclados)
- Requiere que la propiedad de agrupación exista en los datos
- Si hay más de 2-3 grupos, considerar menú de filtros en lugar de secciones

## Referencias

- Archivo original: `src/app/catalogo/page.tsx` (MUNAY)
- Patrón aplicado: filtrar productos por `condition` en grids separados
