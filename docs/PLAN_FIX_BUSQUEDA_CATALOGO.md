# Plan de Corrección — "No pudimos realizar la búsqueda" en /catalogo

> Estado: **PROPUESTO** — pendiente de aprobación por 5 revisores.
> Alcance: fix del error de búsqueda del catálogo (cualquier texto con `q` rompe la página).

---

## 1. FASE 0 — Auditoría y diagnóstico (completada)

### 1.1 Síntoma reportado
Al escribir cualquier término en el buscador del catálogo aparece:
> "No pudimos realizar la búsqueda. Inténtalo nuevamente."

Cargar el catálogo SIN búsqueda funciona; la búsqueda con texto (`?q=...`) falla.

### 1.2 Evidencia de diagnóstico

**a) Dónde se origina el error.**
`src/app/catalogo/page.tsx` (línea ~74) captura cualquier excepción de `listProducts(filters)`
y setea `searchError = true` → muestra el mensaje amigable. El stack trace real va a
`console.error('[catalogo] error de búsqueda:', err)`.

**b) Causa raíz — índice de parámetros compartido entre queries (CONFIRMADO empíricamente).**

En `src/lib/queries/products-neon.ts`, `listProducts` construye DOS queries SQL
independientes (productos del admin + listings P2P) pero comparten el MISMO contador
`paramIdxRef`:

- Bloque 1 (products): con `q`, usa `$1` y avanza `paramIdxRef.current` → queda en `2`.
- Bloque 2 (P2P): usa `paramIdxRef.current` (ahora `2`) para generar `$2`, pero
  `listingParams` es un array NUEVO que arranca con 1 solo elemento → mismatch.

Reproducción contra la BD real (mismo SQL que genera el código, `q='chaqueta'`):
```
SQL_GENERADO: ... AND (ul.title ILIKE $2 OR ul.description ILIKE $2) ...
PARAMS: ["%chaqueta%"]
ERR_REPRODUCIDO: could not determine data type of parameter $1 (code 42P18)
CONTROL_OK rows: 0   ← con $1 funciona
```

**c) Por qué no se detectó antes:**
- La búsqueda e2e usa "MUNAY10" (parece código flash) → redirige antes de llegar a la query P2P.
- Sin `q` (navegación normal), ambos bloques generan queries sin parámetros → sin mismatch.
- La búsqueda real con texto (único caso que dispara el bug) no estaba cubierta por e2e.

**d) Condiciones exactas del bug:**
- `f.q` definido Y `includeP2P = true` (condition ≠ 'new' y sin flash activo).
- Con flash activo o filtro 'new', `includeP2P = false` → no hay bug (pero el fix aplica igual).

### 1.3 Archivos involucrados
- `src/lib/queries/products-neon.ts` — contador de parámetros del bloque P2P (fix principal).
- `src/app/catalogo/page.tsx` — boundary de error (sin cambios funcionales; ya muestra el error state).
- `tests/e2e/checkout-flow.spec.ts` — añadir cobertura de búsqueda con texto real.

### 1.4 Qué YA funciona
- Navegación del catálogo sin búsqueda.
- Búsqueda con código flash (redirección o filtrado por `?flash=`).
- Manejo de errores amigable (error state, empty state, reintentar, limpiar búsqueda).

### 1.5 Qué está ROTO
- Toda búsqueda con texto normal (`?q=`) rompe la query P2P por el mismatch de parámetros.

---

## 2. FASE P — Plan de corrección

### P1. Fix principal: contador de parámetros independiente por bloque
**Archivo:** `src/lib/queries/products-neon.ts`

El bloque P2P debe usar su propio contador local que arranque en `1`, porque es una
query SQL independiente (cada `query()` recibe su propio array de params):

```ts
// ── 2. P2P listings publicados (user_listings) ──
if (includeP2P) {
  const listingParamIdx = { current: 1 }   // ← NUEVO contador local
  const listingWhere: string[] = ["ul.status IN ('verified', 'published')", 'ul.active = true']
  const listingParams: any[] = []

  if (f.q) {
    listingWhere.push(`(ul.title ILIKE $${listingParamIdx.current} OR ul.description ILIKE $${listingParamIdx.current})`)
    listingParams.push(`%${f.q}%`)
    listingParamIdx.current++
  }
  if (f.minPriceCents !== undefined) {
    listingWhere.push(`ul.price_cents >= $${listingParamIdx.current}`)
    listingParams.push(f.minPriceCents)
    listingParamIdx.current++
  }
  if (f.maxPriceCents !== undefined) {
    listingWhere.push(`ul.price_cents <= $${listingParamIdx.current}`)
    listingParams.push(f.maxPriceCents)
    listingParamIdx.current++
  }
  // ... query con listingParams
}
```

**Por qué:** el bloque 1 (products) y el bloque 2 (P2P) son dos `query()` separados;
cada uno debe indexar sus placeholders desde `$1`. Compartir `paramIdxRef` entre ambos
rompe la numeración del segundo cuando el primero usó parámetros.

### P2. Verificación de no-regresión en los demás filtros
- Revisar que `paramIdxRef` (bloque 1) sigue numerando bien: `q`, `condition`, `grading`,
  `minPrice`, `maxPrice`, `flashCampaign`, `flashCode` → sin cambios en ese bloque.
- Confirmar que el bloque P2P con `minPrice`/`maxPrice` (sin `q`) también numeraba mal
  antes (mismo bug: `$2`/`$3` con params desde 0) y queda corregido con el contador local.

### P3. Cobertura e2e
**Archivo:** `tests/e2e/checkout-flow.spec.ts`
Añadir un test de búsqueda con texto real (p. ej. `chaqueta`):
- Navegar a `/catalogo?q=chaqueta` → NO debe mostrar "No pudimos realizar la búsqueda".
- Debe mostrar el heading "Catálogo" (y el grid de resultados o el empty state).
- Verificar además `?q=texto-inexistente` → empty state "No encontramos resultados".

### P4. Validación
1. `npx tsc --noEmit` — 0 errores.
2. `npx eslint` sobre los archivos tocados.
3. **Smoke test real contra Neon (GATE AUTORITATIVO):** el e2e corre en modo demo
   (`listProducts` hace early-return `[]` si `!isDbConfigured()`, así que el SQL con
   el bug jamás se ejecuta en CI sin DATABASE_URL). El smoke test debe replicar la
   query P2P con contador local y cubrir COMBINACIONES: (a) q solo; (b) minPrice solo;
   (c) minPrice+maxPrice; (d) q+minPrice+maxPrice; y caracteres especiales
   (`q='100% algodón'`, `q="O'Brien"`). Sin error y con filas en todos.
4. **Grep de verificación del patrón** en src/: `paramIdxRef|paramIndex|current: 1|let idx`
   — revisar si OTROS archivos (coupons.ts, loyalty-coupons.ts, rutas admin,
   flash-codes) comparten contador entre múltiples query(). Si hay candidatos,
   corregir o documentar.
   **Resultado:** único candidato fue `src/lib/queries/user-listings.ts:31`
   (`getPublishedListings`), REVISADO y CONFIRMADO correcto: es una sola query
   donde `paramIdx` alimenta `category` y `LIMIT` dentro del MISMO array de params
   (`[...params, limit]`) — no es el patrón del bug. El resto usa tagged templates
   auto-numeradas o placeholders fijos.
5. `next build` — producción.
6. E2E Playwright completo (incluido el nuevo test de búsqueda, colocado DESPUÉS del
   test de catálogo existente para ruta caliente; aserción positiva primero).
7. **Ronda post-implementación:** revisar los cambios con 5 revisores en paralelo y
   corregir issues.
8. **Deploy:** git commit + push a master → Vercel auto-deploy.

### P5. Regresión funcional
- Buscar término existente → resultados (o empty state correcto).
- Buscar texto inexistente → empty state "No encontramos resultados" (NO error).
- Buscar con caracteres especiales (`%`, `_`, `'`) → sin error (ILIKE parametrizado).
- Navegar con filtros (condition/grading/precio) → sin error.
- Código flash válido → sigue redirigiendo/filtrando.

---

## 3. Criterios de aceptación
1. Buscar cualquier texto en el catálogo NO muestra "No pudimos realizar la búsqueda".
2. La búsqueda devuelve resultados reales o el empty state correcto según el término.
3. Los filtros combinados con búsqueda funcionan (sin mismatch de parámetros).
4. `tsc`, `lint`, `build` y e2e pasan (incluido el nuevo test).
5. Ningún cambio de contrato de API ni de la UI del catálogo.

## 4. Archivos a modificar (final)
- `src/lib/queries/products-neon.ts` (fix funcional)
- `tests/e2e/checkout-flow.spec.ts` (cobertura de búsqueda)
- `docs/PLAN_FIX_BUSQUEDA_CATALOGO.md` (este plan)

## 5. Riesgos
- Bajo: cambio quirúrgico de numeración de placeholders en un solo bloque de una función.
- Se valida con smoke test real contra Neon (gate autoritativo) + build + e2e antes del deploy.
- Nota cosmética: el error reproducido dice "could not determine data type of parameter
  $1" (42P18) aunque el SQL use $2 — el texto exacto varía por driver; lo probado es
  el mismatch de numeración, confirmado por el control con $1 que sí funciona.
