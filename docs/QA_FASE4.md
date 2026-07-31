# QA Fase 4 — Verificación y Checklist

> **Fecha:** Julio 2026
> **Rama:** redesign-v2-palette
> **Módulos cubiertos:** 1-6

---

## ✅ Checklist de migración de paleta

| # | Ítem | Estado | Evidencia |
|:---:|---|---|---|
| 1 | No queda `bg-munay-red-500/600/800` en componentes | ✅ | 0 matches en `src/**/*.{tsx,ts}` |
| 2 | No queda `text-munay-red-500/600/800` en componentes | ✅ | 0 matches en `src/**/*.{tsx,ts}` |
| 3 | No queda `border-munay-red-*` en componentes | ✅ | 0 matches en `src/**/*.{tsx,ts}` |

> **Re-verificado (post-deploy v3):** En una auditoría de residuos con 5 revisores se detectaron 8 usos residuales de `munay-red-*`
> en `soporte/page.tsx`, `info/page.tsx`, `cuenta/page.tsx` y `cuenta/puntos/page.tsx` que se habían escapado.
> Todos fueron migrados a `munay-terracota*`. Verificación final: **0 matches** en `src/`. También se localizaron los
> textos "Week Buy" → "Compra de la semana" y se actualizó `/info` (Kushki → checkout WhatsApp).
| 4 | No queda rojo puro (`#FF0000`, `#dc2626`, `#ef4444`) | ✅ | 0 matches en `src/**/*` |
| 5 | Iconos confianza (Truck, ShieldCheck) en Turquesa | ✅ | `text-munay-turquesa` en `p/[slug]/page.tsx` |
| 6 | Badge "LIVE" en Terracota Quemado con pulse | ✅ | `bg-munay-terracota-quemado` + `animate-pulse` en `live-codes.tsx` |
| 7 | CTAs principales en Terracota (#C65A2E) | ✅ | Botones en header, catálogo, checkout, admin |
| 8 | WhatsApp #25D366 tokenizado como `--munay-whatsapp` | ✅ | 0 matches de hex hardcodeado |

## ✅ Checklist de dark mode

| # | Ítem | Estado | Valor |
|:---:|---|---|---|
| 1 | `--munay-terracota` (dark) | ✅ | `#E07B4A` |
| 2 | `--munay-terracota-quemado` (dark) | ✅ | `#C65A2E` |
| 3 | `--munay-cacao` (dark) | ✅ | `#5C3830` |
| 4 | `--munay-turquesa` (dark) | ✅ | `#4DCEC7` |
| 5 | `--munay-crema` (dark) | ✅ | `#2A2520` |
| 6 | `--munay-warm-gray` (dark) | ✅ | `#8A8278` |
| 7 | `@custom-variant dark` configurado | ✅ | `&:is(.dark *)` |

## ✅ Checklist de Módulos funcionales

| # | Módulo | Ítem | Estado |
|:---:|:---:|---|---|
| 1 | M1 — Puntos/Niveles | Tabla `loyalty_levels` + vista `user_levels` | ✅ |
| 2 | M1 — Puntos/Niveles | `LevelBadge` con colores por nivel | ✅ |
| 3 | M1 — Puntos/Niveles | `LevelProgressBar` con progresión | ✅ |
| 4 | M2 — Campañas Flash | Tabla `flash_campaigns` + vista `active_campaigns` | ✅ |
| 5 | M2 — Campañas Flash | `CampaignBanner` con countdown real y estados | ✅ |
| 6 | M2 — Campañas Flash | Admin: listado + toggle campañas | ✅ |
| 7 | M2 — Campañas Flash | Filtro "En oferta flash" en catálogo | ✅ |
| 8 | M3 — Week Buy | Tabla `week_buy_campaigns` + `week_buy_commitments` | ✅ |
| 9 | M3 — Week Buy | `WeekBuyBanner` con Estados A/B + countdown | ✅ |
| 10 | M3 — Week Buy | Admin: listado + toggle campañas | ✅ |
| 11 | M4 — Live Codes | `getActiveFlashCodes()` con datos reales | ✅ |
| 12 | M4 — Live Codes | `MunayLiveCodes` sin datos hardcodeados | ✅ |
| 13 | M5 — Marketplace P2P | Tabla `user_listings` + vista `published_listings` | ✅ |
| 14 | M5 — Marketplace P2P | `/publicar` formulario + API route | ✅ |
| 15 | M5 — Marketplace P2P | `/cuenta/mis-publicaciones` + UserMenu link | ✅ |
| 16 | M5 — Marketplace P2P | Admin: verificación/rechazo de listings | ✅ |
| 17 | M5 — Marketplace P2P | `TrustBadge` en Turquesa (Regla de Oro) | ✅ |
| 18 | M6 — UI Components | `CountdownTimer` reutilizable | ✅ |
| 19 | M6 — UI Components | `StockBadge` con estados | ✅ |
| 20 | M6 — UI Components | `LiveCodeCard` reutilizable | ✅ |
| 21 | M6 — UI Components | Barrel export `@/components/shared` | ✅ |

## ⚠️ Items documentados como pendientes (no blocker)

| # | Pendiente | Prioridad |
|:---:|---|---|
| 1 | Subida de imágenes en `/publicar` (Cloudinary) | 🟡 Media |
| 2 | Motivo de rechazo en admin verify listings | 🟢 Baja |
| 3 | Página de detalle de listing (`/publicar/[id]`) | 🟢 Baja |
| 4 | `getPublishedListings()` conectar al catálogo principal | 🟡 Media |
| 5 | `recalculateUserLevel()` conectar con `award_points` | 🟡 Media |
| 6 | Notificaciones Brevo para Week Buy meta alcanzada | 🟡 Media |
| 7 | UI de creación de campañas en admin (Week Buy, Flash) | 🟢 Baja |

---

## Resultado general

> **✅ FASE 4 COMPLETADA**
> 
> Todos los items del checklist de verificación están en verde.
> La paleta Munay v2 está completamente migrada y operativa.
> Los Módulos 1-6 están implementados, typecheckean sin errores,
> y siguen la Regla de Oro de colores.
> 
> Pendientes documentados (no blocker) para futuras iteraciones.
