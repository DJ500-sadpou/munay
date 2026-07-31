# Plan v3 — Ajustes Estratégicos MUNAY

> **Versión:** v3 — Julio 2026
> **Rama base:** `redesign-v2-palette`
> **Documentos relacionados:** `QA_FASE4.md`, `PLAN_MIGRACION_PALETA_Y_LOGICA.md`, `PLAN_PENDIENTES.md`

---

## Auditoría de lo construido (pre-requisito)

### ✅ Completado y funcional

| Módulo | Estado | Componentes/Archivos clave |
|:---:|:---:|---|
| Paleta v2 | ✅ Completa | 0 residuos rojo puro, dark mode configurado |
| M1 — Puntos/Niveles | ✅ Completo | `LevelBadge`, `LevelProgressBar`, migración 00013, vista `user_levels` |
| M2 — Campañas Flash | ✅ Completo | Tabla `flash_campaigns`, `CampaignBanner`, admin toggle, filtro catálogo |
| M3 — Week Buy | ✅ Completo | Tabla `week_buy_campaigns`, `WeekBuyBanner` (A/B), admin list |
| M4 — Códigos en Vivo | ✅ Completo | `getActiveFlashCodes()`, `MunayLiveCodes` datos reales, pulse LIVE badge |
| M5 — Marketplace P2P | ✅ Completo | Tabla `user_listings`, `/publicar`, `/cuenta/mis-publicaciones`, admin verify |
| M6 — UI Components | ✅ Completo | `CountdownTimer`, `StockBadge`, `LiveCodeCard`, barrel export |
| QA Fase 4 | ✅ Documentado | Checklist completo en `docs/QA_FASE4.md` |

### 🔄 Pendientes documentados (no blocker)

| # | Pendiente | Prioridad | Módulo |
|:---:|---|---|:---:|
| 1 | Subida de imágenes en `/publicar` (Cloudinary) | 🟡 Media | M5 |
| 2 | Motivo de rechazo en admin verify listings | 🟢 Baja | M5 |
| 3 | Página detalle listing `/publicar/[id]` | 🟢 Baja | M5 |
| 4 | `getPublishedListings()` conectar al catálogo | 🟡 Media | M5 |
| 5 | `recalculateUserLevel()` conectar con `award_points` | 🟡 Media | M1 |
| 6 | Notificaciones Brevo Week Buy meta alcanzada | 🟡 Media | M3 |
| 7 | UI creación campañas en admin (Week Buy, Flash) | 🟢 Baja | M2/M3 |

---

## Los 3 Ajustes Estratégicos

---

### AJUSTE 1 — "Week Sale" → "Quincena MUNAY" + inmutabilidad

#### 1.1 Renombrar en toda la interfaz

| Buscar | Reemplazar por | Archivos afectados |
|---|---|---|
| `'week_sale'` (type enum) | `'quincena'` | `00014_flash_campaigns.sql` (type enum), `campaign.ts`, `flash-campaigns.ts`, `campaign-banner.tsx`, `campaigns-list.tsx` |
| `"Week Sale"` (texto UI) | `"Quincena MUNAY"` | `campaign-banner.tsx`, `campaigns-list.tsx`, `page.tsx` |
| `"Ofertas Flash"` (copy nav/UI) | `"Quincena MUNAY"` | `header.tsx`, `page.tsx`, `live-codes.tsx` |
| `"week_sale"` en queries | `"quincena"` | `flash-campaigns.ts` |

#### 1.2 Nuevo campo: `categoria_tematica`

Añadir a la tabla `flash_campaigns` y al tipo `Campaign`:

```sql
-- Nueva columna en flash_campaigns
categoria_tematica text  -- ej: 'Nuevos ingresos', 'Segunda mano curada', 'Denim'
```

```typescript
// En Campaign type
categoria_tematica: string | null
```

#### 1.3 Regla de inmutabilidad de campañas finalizadas

**REGLAS DE NEGOCIO (implementar en backend, no solo UI):**

1. Cuando `ends_at < now()`, la campaña pasa a estado `ended` permanentemente.
2. El endpoint de toggle (`/api/admin/campaigns/toggle`) NO debe permitir reactivar una campaña cuyo `ends_at < now()`.
3. La función `createCampaign()` rechaza `ends_at` en el pasado.
4. Para lanzar una nueva edición: crear NUEVO registro (nuevo UUID), nunca reabrir una campaña finalizada.
5. La vista `active_campaigns` ya filtra `ends_at > now()` — esto es correcto.

**Validaciones a nivel de queries:**

```typescript
// En createCampaign():
if (new Date(data.ends_at) <= new Date()) {
  throw new Error('ends_at debe ser en el futuro')
}

// En toggleCampaign():
const campaign = await getCampaignById(campaignId)
if (campaign && campaign.status === 'ended') {
  return false  // No reactivar campañas finalizadas
}
```

#### 1.4 Countdown server-side

✅ YA IMPLEMENTADO — el `CampaignBanner` recibe `seconds_remaining` desde la vista `active_campaigns` que usa `extract(epoch from (fc.ends_at - now()))::bigint` (SQL nativo). El cliente solo decrementa localmente desde ese valor base.

**Verificación:** `seconds_remaining` se calcula en la vista SQL, no en el navegador. ✅

---

### AJUSTE 2 — Códigos en Vivo priorizados (ya implementado)

✅ **El Módulo 4 (Códigos en Vivo) ya está completamente implementado**, antes que el Módulo 3 (Week Buy). Ver:

- `getActiveFlashCodes()` — query con datos reales desde `flash_codes`
- `MunayLiveCodes` — componente client con datos reales, sin mock data
- Badge LIVE en Terracota Quemado con `animate-pulse`
- Estado vacío manejado con fallback visual
- Botón "Ver todos los códigos" → `/flash`

**Acción requerida:** No hay cambios de implementación pendientes para este ajuste. Se confirma que el Módulo 4 está completo y funcional.

---

### AJUSTE 3 — Nuevo componente `StockRealBadge`

#### 3.1 Especificación

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `quantity` | number | — | Stock disponible |
| `esUnica` | boolean | `false` | Si es pieza única de segunda mano |
| `size` | `'sm' \| 'md'` | `'sm'` | Tamaño del badge |

#### 3.2 Reglas de visualización

| Condición | Texto | Color |
|---|---|---|
| `esUnica === true` o `quantity === 1` (usada) | `"Pieza única — cuando se acaba, se acaba de verdad."` | Terracota (#C65A2E) — acción/autenticidad |
| `quantity > 1 && quantity <= lowStockThreshold` | `"Quedan solo X unidades"` | Terracota — moderado |
| `quantity > lowStockThreshold` | `"Stock real: X unidades"` | Terracota — moderado |
| `quantity <= 0` | `"Sin stock"` | Warm Gray — inactivo |

#### 3.3 Regla de color

- **Terracota** (#C65A2E): para mensajes de autenticidad/stock real (moderado, no urgente)
- **NUNCA Terracota Quemado**: reservado para urgencia máxima de Quincena MUNAY
- **Warm Gray**: para "Sin stock" (inactivo)

#### 3.4 Ubicación

En la ficha de producto (`p/[slug]/page.tsx`), cerca del badge de "Higienizada y verificada" (TrustBadge), para reforzar juntos el mensaje de autenticidad.

---

## Orden de implementación

| Orden | Trabajo | Rama | Dependencias |
|:---:|---|---|:---:|
| 0 | ✅ Auditoría — COMPLETADA | — | — |
| 1 | **Ajuste 1.1**: Renombrar `week_sale` → `quincena` en SQL, types, queries, UI | `redesign-v2-palette` | Ninguna |
| 2 | **Ajuste 1.2**: Añadir `categoria_tematica` a SQL migration + type + queries | `redesign-v2-palette` | Paso 1 |
| 3 | **Ajuste 1.3**: Implementar validación de inmutabilidad en `toggleCampaign()` y `createCampaign()` | `redesign-v2-palette` | Paso 2 |
| 4 | **Ajuste 3**: Crear `StockRealBadge` component + integrar en `p/[slug]/page.tsx` | `redesign-v2-palette` | Ninguna |
| 5 | **Typecheck** + 5 revisores + corregir issues | — | Pasos 1-4 |
| 6 | **Deploy** a Vercel producción | `redesign-v2-palette` → `master` | Paso 5 |

### Archivos a modificar por paso

#### Paso 1 — Renombrar `week_sale` → `quincena`

| Archivo | Cambio |
|---|---|
| `supabase/migrations/00014_flash_campaigns.sql` | type enum: `'week_sale'` → `'quincena'`, comment table |
| `src/types/campaign.ts` | `CampaignType`: `'week_sale'` → `'quincena'` |
| `src/lib/queries/flash-campaigns.ts` | `createCampaign()` default type + `getActiveFlashProductIds()` |
| `src/components/loyalty/campaign-banner.tsx` | `isWeekSale` → `isQuincena`, textos UI |
| `src/components/admin/campaigns-list.tsx` | Header "Week Sale" → "Quincena MUNAY" |

#### Paso 2 — Añadir `categoria_tematica`

| Archivo | Cambio |
|---|---|
| `supabase/migrations/00017_quincena_munay.sql` (NUEVA) | ALTER TABLE flash_campaigns ADD COLUMN categoria_tematica |
| `src/types/campaign.ts` | Añadir `categoria_tematica: string \| null` |
| `src/lib/queries/flash-campaigns.ts` | `createCampaign()` acepta `categoriaTematica`, `mapRowToCampaign()` lo mapea |
| `src/components/loyalty/campaign-banner.tsx` | Mostrar `categoria_tematica` si existe |
| `src/components/admin/campaigns-list.tsx` | Mostrar `categoria_tematica` en card |

#### Paso 3 — Validación de inmutabilidad

| Archivo | Cambio |
|---|---|
| `src/lib/queries/flash-campaigns.ts` | `createCampaign()`: validar `ends_at` futuro. `toggleCampaign()`: rechazar si status es `'ended'` |
| `src/app/api/admin/campaigns/toggle/route.ts` | Añadir validación server-side adicional (defense in depth) |

#### Paso 4 — StockRealBadge

| Archivo | Cambio |
|---|---|
| `src/components/shared/stock-real-badge.tsx` (NUEVO) | Componente con lógica de pieza única vs múltiples |
| `src/components/shared/index.ts` | Exportar `StockRealBadge` |
| `src/app/p/[slug]/page.tsx` | Integrar `StockRealBadge` cerca de `TrustBadge` |

---

## Entregables esperados

1. ✅ **Reporte de auditoría inicial** — Este documento, sección arriba.
2. ✅ **Confirmación: "Ya no queda ningún rojo puro en la interfaz"** — Verificado con 0 matches.
3. 📦 **Modelo de datos Campaign actualizado** — Con `categoria_tematica` y manejo de estado `ended` inmutable (Paso 2-3).
4. 📦 **Countdown server-side** — ✅ Ya implementado vía vista `active_campaigns` con `extract(epoch from ...)`.
5. 📦 **StockRealBadge** — Nuevo componente con lógica de pieza única (Paso 4).
6. 📦 **Renombre completo** — "Week Sale" → "Quincena MUNAY" en toda la interfaz (Paso 1).

---

## Estrategia de reversibilidad

```bash
# Commit por cada paso para poder revertir individualmente
git add -A && git commit -m "feat(ajuste1): renombrar week_sale a quincena en toda la interfaz"
git add -A && git commit -m "feat(ajuste1): añadir campo categoria_tematica + migración 00017"
git add -A && git commit -m "feat(ajuste1): implementar inmutabilidad campañas finalizadas"
git add -A && git commit -m "feat(ajuste3): crear StockRealBadge + integrar en p/[slug]"

# Revertir un paso específico:
git revert <commit-hash>
```
