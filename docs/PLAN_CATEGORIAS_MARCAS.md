# Plan — Categorías de producto + Marcas (filtros, landing y admin)

> Estado: **PROPUESTO** — pendiente de revisión con 5 revisores.
> Stack: Next.js + Neon (Postgres) + Clerk + Vercel. Paleta MUNAY vigente (no tocar).
> Regla: NO se implementa nada hasta aprobar este plan.

---

## 1. FASE 0 — Auditoría y diagnóstico (reporte entregado)

### 1.1 Archivos involucrados

| Archivo | Rol |
|---|---|
| `supabase/migrations/00001_init_schema.sql` | Esquema base de `products` (SIN `categoria` ni `marca`) |
| `src/lib/queries/products-neon.ts` | `listProducts`, `ProductFilters`, `parseFiltersFromSearchParams` |
| `src/components/catalogo/catalog-filters.tsx` | Panel de filtros (URL-driven con `buildHref`) |
| `src/app/catalogo/page.tsx` | Página catálogo (parsea search params, cuenta resultados) |
| `src/lib/munay-data.ts` | `CATEGORIES` (íconos de la landing) |
| `src/components/munay/category-bar.tsx` | Render de los íconos |
| `src/components/admin/product-form.tsx` | Form de producto (sin categoría/marca) |
| `src/app/api/admin/products/route.ts` + `[id]/route.ts` | POST/PUT productos |
| `src/app/admin/products/[id]/page.tsx` + `new/page.tsx` | Páginas admin de producto |
| `src/app/admin/page.tsx` | Dashboard admin (sin sección de marcas) |
| `src/types/database.ts` | Tipos TS del esquema |

### 1.2 Qué ya funciona

- Catálogo con filtros URL: Ordenamiento, Condición (Todas/Nuevas/Usadas), Estado/grading (Todos/Excelente/Bueno/Regular), rango de precio, flash activo, "En oferta flash", limpiar.
- Contador "X prendas encontradas" (deriva de `products.length` en la página).
- Admin crea/edita productos (título, slug, precio, stock, condición, grading, activo, imágenes).
- Landing con barra de categorías (íconos).

### 1.3 Qué está roto / incompleto (lo que pide el usuario)

1. **Íconos de la landing no filtran**: `CATEGORIES` apunta a `/catalogo?cat=chaquetas` pero el catálogo NO lee el param `cat` → todos los íconos caen al catálogo general sin filtrar. (Causa raíz confirmada: `parseFiltersFromSearchParams` solo lee `condition/grading/minPrice/maxPrice/sort/q/flash/flashCampaign`.)
2. **No existe filtro de Categoría** en el panel del catálogo.
3. **No existe campo `categoria` ni `marca`** en la tabla `products` → no hay dónde guardar la clasificación.
4. **No existe tabla `brands`** ni gestión de marcas en admin.
5. **No existe página `/marcas`**; el ícono "Marcas" cae al catálogo.
6. **Admin de producto** no permite asignar categoría ni marca.

### 1.4 Decisiones de diseño (validar con revisores)

- **D1 — Vocabulario de categorías**: lista fija de 7 (valores slug en minúsculas): `chaquetas, tops, pantalones, zapatillas, bolsos, vestidos, accesorios`. "Todas" y "Marcas" NO son categorías de producto. Se centraliza en `src/lib/categories.ts` (única fuente, usada por admin, filtros y validación server-side).
- **D2 — Columna `categoria` nullable**: `ALTER TABLE products ADD COLUMN categoria text`. Los productos EXISTENTES quedan con `NULL` (aparecen en "Todas" pero no en ningún filtro de categoría hasta que el admin los clasifique). El formulario admin la exige al crear/editar. Evita un `DEFAULT` arbitrario que etiquetaría mal todo el catálogo actual.
- **D3 — `brands` con `slug` único**: la tabla lleva `slug text not null unique` (generado con `slugify(nombre)`) para URLs limpias tipo `/catalogo?marca=nike` (consistente con `products.slug`). Marca inactiva NO se borra: `marca_id` usa `ON DELETE SET NULL` y el toggle solo cambia `activo` (no rompe productos asignados).
- **D4 — Filtro de categoría/marca excluye P2P**: `user_listings` usa un vocabulario de categorías distinto (`camisetas/blusas/faldas/calzado/otro`…) y marca es texto libre, no FK a `brands`. Mezclarlos bajo un filtro de categoría del catálogo curado daría resultados incoherentes y contador incorrecto (criterio #7). Cuando `categoria` o `marca` estén activos, `includeP2P = false` (mismo patrón que `condition='new'`). Documentar en la UI del catálogo si es necesario.
- **D5 — Filtro de marca sin selector visible**: solo vía URL (`/marcas` → `/catalogo?marca=slug`), como pide el prompt. El panel de filtros NO muestra el selector de marca en esta iteración.
- **D6 — Defensivo pre-migración**: las queries solo referencian `categoria`/`marca_id` cuando el filtro está activo (WHERE condicional), así el catálogo por defecto funciona aunque la migración 00024 aún no se haya aplicado en Neon. Las queries de marcas de admin usan try/catch (patrón ya usado con `coupons`) → devuelven `[]` si la tabla no existe.

### 1.5 Tablas de Neon afectadas

- `products`: + `categoria text` (nullable), + `marca_id uuid REFERENCES brands(id) ON DELETE SET NULL`.
- `brands` (NUEVA): `id uuid pk`, `slug text not null unique`, `nombre text not null unique`, `activo boolean default true`, `created_at timestamptz`.

---

## 2. P1 — Migración SQL 00024 (`categorias_marcas`)

```sql
-- 00024_categorias_marcas.sql
create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (char_length(slug) between 1 and 100),
  nombre     text not null check (char_length(nombre) between 1 and 100),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
-- [FIX R2/R3] unique index case-insensitive: text UNIQUE es case-sensitive,
-- "Nike" y "nike" pasarían ambos; con lower(nombre) se evita el dup.
create unique index if not exists idx_brands_nombre_lower on public.brands (lower(nombre));

-- [FIX R2/R3] CHECK del vocabulario fijo (defense-in-depth; los NULL de
-- productos pre-clasificación siguen pasando).
alter table public.products
  add column if not exists categoria text
    constraint products_categoria_check
      check (categoria is null or categoria in ('chaquetas','tops','pantalones','zapatillas','bolsos','vestidos','accesorios')),
  add column if not exists marca_id uuid references public.brands(id) on delete set null;

create index if not exists idx_products_categoria on public.products(categoria);
create index if not exists idx_products_marca on public.products(marca_id);
```

NOTA [FIX R3]: `ADD COLUMN IF NOT EXISTS ... REFERENCES` omite la FK si la columna
ya existe (gotcha de Postgres). Es una migración one-time sobre esquema fresco, así
que está bien; documentado. El usuario la ejecuta en Neon (flujo habitual). Entregar
SQL inline en el resumen final.

---

## 2bis. Correcciones incorporadas (Ronda Plan R1–R5)

1. **BUG crítico `categoria: 'all'` (R4/R5)**: `listProducts` DEBE usar
   `if (f.categoria && f.categoria !== 'all')` (nunca `if (f.categoria)`) y
   `includeP2P` usa `f.categoria === 'all' || !f.categoria` — imita el patrón
existente de `condition`. `parseFilters` normaliza `categoria` a `'all'` cuando
falta o es inválida (sentinel canónico, consistente con condition/grading).
2. **`/marcas` con `export const dynamic = 'force-dynamic'` (R4)**: sin esto,
   Next prerenderiza estático y congela la lista de marcas en build.
3. **Unicidad case-insensitive de marcas (R2/R3)**: `unique index on
   lower(nombre)` en vez de depender solo de `text unique` en `nombre`.
4. **Edición con marca inactiva (R5)**: `product-form` recibe TODAS las marcas
   (`listAllBrandsForAdmin`) y preselecciona `product.marca_id` aunque la marca
   esté inactiva (etiqueta "(inactiva)"); el Select solo ofrece marcas activas
   para elegir + "Sin marca".
5. **Validación server-side de `marca_id` (R5)**: POST/PUT verifican
   `EXISTS (SELECT 1 FROM brands WHERE id = $x AND activo = true)` → 400 si no
   existe o está inactiva (no solo formato UUID).
6. **Indicador de marca activa en catálogo (R2)**: banner "Marca: {nombre}" +
   "Quitar filtro" (patrón `flashCodeActive`) cuando `?marca=` está activo.
7. **CHECK de vocabulario en `categoria` (R2/R3)**: en la migración.
8. **APIs de brands con patrón EXACTO de `/api/admin/products`** (`auth()` +
   `currentUser()` + `checkAdminRow`), no `requireAdmin` (que es para páginas).
9. **Slug de marca validado en parseFilters** (trim, ≤100) y `getBrandBySlug`
   para el banner; `buildHref` preserva `marca`.

---

## 3. P2 — Capa de datos (libs + tipos)

### 3.1 `src/lib/categories.ts` (nuevo)

```ts
export const PRODUCT_CATEGORIES = [
  { value: 'chaquetas', label: 'Chaquetas' },
  { value: 'tops', label: 'Tops' },
  { value: 'pantalones', label: 'Pantalones' },
  { value: 'zapatillas', label: 'Zapatillas' },
  { value: 'bolsos', label: 'Bolsos' },
  { value: 'vestidos', label: 'Vestidos' },
  { value: 'accesorios', label: 'Accesorios' },
] as const
export const PRODUCT_CATEGORY_VALUES = PRODUCT_CATEGORIES.map((c) => c.value) as readonly string[]
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c) => [c.value, c.label])
)
```

### 3.2 `src/lib/queries/brands.ts` (nuevo)

- `listActiveBrands(): Promise<{ id, slug, nombre }[]>` — `WHERE activo = true ORDER BY nombre`.
- `listAllBrandsForAdmin(): Promise<{ id, slug, nombre, activo, created_at, products_count }[]>` — LEFT JOIN conteo de productos.
- `createBrand(nombre): Promise<{ id, slug }>` — `slugify(nombre)`, maneja 23505 (nombre/slug duplicado).
- `setBrandActive(id, activo): Promise<void>`.
- Todas con `isDbConfigured()` guard + try/catch defensivo (D6).

### 3.3 `src/types/database.ts`

- `products.Row/Insert/Update`: `categoria: string | null`, `marca_id: string | null`.
- Nueva tabla `brands` en el tipo `Database`.

### 3.4 `src/lib/queries/products-neon.ts`

- `ProductFilters`: + `categoria?: string`, `marca?: string`.
- `parseFiltersFromSearchParams`: lee `categoria` (validada contra `PRODUCT_CATEGORY_VALUES`, si no → undefined) y `marca` (trim, slug-safe).
- `listProducts`:
  - Bloque products: `if (f.categoria) where.push('p.categoria = $N')`; `if (f.marca) where.push('p.marca_id IN (SELECT id FROM brands WHERE activo = true AND slug = $N)')` (ambos con su propio `paramIdxRef` consecutivo).
  - `includeP2P = f.condition !== 'new' && !flashInfo && !f.categoria && !f.marca` (D4).
- Re-export en `src/lib/queries/products.ts` (compat) — no requiere cambio (re-exporta todo).

---

## 4. P3 — Filtro de Categoría en el catálogo

`src/components/catalogo/catalog-filters.tsx`:
1. `buildHref`: agregar `if (merged.categoria && merged.categoria !== 'all') params.set('categoria', merged.categoria)` y `if (merged.marca) params.set('marca', merged.marca)`.
2. Nueva sección "Categoría" (entre Condición y Estado) con el MISMO patrón de Links que condition/grading: Todas + las 7 de `PRODUCT_CATEGORIES` (`buildHref({ categoria: v })`), con estado activo visual.
3. El `DEFAULT_FILTERS` suma `categoria: 'all'` (marca queda fuera, es solo URL).
4. La página `/catalogo` no cambia: `totalCount = products.length` ya refleja la combinación (criterio #7).

---

## 5. P4 — Landing: íconos que filtran + página /marcas

### 5.1 `src/lib/munay-data.ts`

Corregir hrefs de `CATEGORIES` (importar valores de `src/lib/categories.ts`):
- Todas → `/catalogo`
- Chaquetas…Accesorios → `/catalogo?categoria=<value>`
- Marcas → `/marcas`

### 5.2 `src/app/marcas/page.tsx` (nuevo)

- Server component: `listActiveBrands()`.
- Header: título "Marcas", subtítulo "Explora por tu marca favorita."
- Grid de cards (patrón visual MUNAY: fondo crema, cards blancas, CTA terracota) → cada una `Link href="/catalogo?marca=<slug>"`.
- **Empty state** (sin marcas activas): "Aún no tenemos marcas destacadas. Vuelve pronto." + botón "Ver catálogo".
- Metadata: `title: 'Marcas · Munay'`.

---

## 6. P5 — Admin: gestión de marcas

### 6.1 API routes (nuevas)

- `src/app/api/admin/brands/route.ts`: `GET` (listAllBrandsForAdmin), `POST` (createBrand, valida nombre 1-100, 23505 → 409 "Ya existe una marca con ese nombre").
- `src/app/api/admin/brands/[id]/route.ts`: `PATCH` `{ activo }` (toggle). Validación server-side con `requireAdmin`/`checkAdmin` (mismo patrón que `/api/admin/products`).

### 6.2 `src/app/admin/brands/page.tsx` (nuevo)

- Server: `requireAdmin` + `listAllBrandsForAdmin()` → render `<BrandsManager brands={...} />`.

### 6.3 `src/components/admin/brands-manager.tsx` (nuevo, client)

- Form "Agregar marca" (solo nombre) → POST → refresh.
- Tabla/listado: nombre, slug, productos asociados (count), Switch activo/inactivo (PATCH), manejo de error 409.
- Estados vacío/loading/error coherentes con MUNAY.

### 6.4 `src/app/admin/page.tsx`

- Nuevo botón "Marcas" (icono `Tags`) junto a los demás, con link `/admin/brands`.

---

## 7. P6 — Admin: formulario de producto con categoría y marca

### 7.1 `src/components/admin/product-form.tsx`

- Props: + `brands?: Array<{ id: string; nombre: string }>` (marcas ACTIVAS para elegir).
- Estado: `categoria` (default `product?.categoria ?? ''`), `marcaId` (default `product?.marca_id ?? 'none'`).
- UI (grid, mismo estilo):
  - `Select` "Categoría *" obligatorio con las 7 opciones de `PRODUCT_CATEGORIES`; validación client-side si queda vacío.
  - `Select` "Marca" con opción explícita "Sin marca" (`value='none'`) + marcas activas; `marcaId==='none' → null`.
- Payload: + `categoria`, + `marca_id: marcaId === 'none' ? null : marcaId`.

### 7.2 API productos

- `src/app/api/admin/products/route.ts` (POST) y `[id]/route.ts` (PUT):
  - Leer `categoria` (obligatoria, validada contra `PRODUCT_CATEGORY_VALUES`) y `marca_id` (opcional, UUID o null).
  - INSERT/UPDATE con las 2 columnas nuevas.

### 7.3 Páginas admin de producto

- `src/app/admin/products/[id]/page.tsx`: SELECT + `p.categoria, p.marca_id`; pasar al form junto con `listActiveBrands()`.
- `src/app/admin/products/new/page.tsx`: pasar `listActiveBrands()`.

---

## 8. Validación, tests y deploy

1. `tsc --noEmit` (exit code real).
2. ESLint de archivos tocados.
3. `next build`.
4. E2E Playwright (suite completa) + 2 tests nuevos:
   - `/catalogo?categoria=chaquetas` carga (heading Catálogo, sin error de búsqueda).
   - `/marcas` carga (heading Marcas; en demo sin brands muestra el empty state "Vuelve pronto").
5. Deploy: commit + push a master (Vercel auto-deploy). El usuario ejecuta la migración 00024 en Neon (SQL entregado en el resumen).

---

## 9. Checklist de criterios de aceptación

1. ✅ Admin crea producto con categoría obligatoria + marca opcional (P6).
2. ✅ Catálogo filtra por Categoría, combinable con Condición/Estado (P3+P2).
3. ✅ Íconos de la landing (excepto Marcas) → catálogo con `?categoria=` (P4).
4. ✅ "Marcas" → `/marcas` → selección → `/catalogo?marca=` (P4+P5).
5. ✅ Admin crea/lista/activa-desactiva marcas (P5).
6. ✅ Un producto tiene EXACTAMENTE una categoría y ≤1 marca (D2/D3 + validación server-side).
7. ✅ Contador refleja la combinación de filtros (incl. categoría) (P3 — `totalCount=products.length`).
