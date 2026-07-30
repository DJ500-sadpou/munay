# Plan: Migración de Paleta + Nueva Lógica Funcional

> **Versión:** v3 — Actualizado con feedback de 10 revisores (2 rondas)  
> **Documentos relacionados:** `docs/PLAN_VISTA_CATALOGO.md`

---

## Fase 0: Diagnóstico del estado actual

### 🎨 Sistema de colores existente

El proyecto usa Tailwind CSS v4 con `@theme inline` en `globals.css`. Los tokens actuales son:

```css
/* Tokens Munay actuales (en :root) */
--munay-red-500: #f0442d;    /* ≈ terracota claro */
--munay-red-600: #d92a1e;    /* ≈ terracota medio */
--munay-red-800: #a3120c;    /* ≈ terracota oscuro */
--munay-cream:   #f3d3a6;    /* crema dorado cálido */
--munay-ink:     #2a1512;    /* tinta oscura */

/* Tokens semánticos actuales (oklch) */
--primary:    oklch(0.52 0.16 38);   /* terracota profundo — usado en CTAs secundarios, badges "Pagada" */
--accent:     oklch(0.78 0.16 75);   /* ámbar dorado — usado en cupones, fidelidad, highlight */
--destructive: oklch(0.55 0.22 27);  /* rojo — usado en errores, eliminar */
```

**⚠️ Observación clave:** La paleta actual NO es "rojo agresivo genérico". Los valores `#f0442d`, `#d92a1e` son **terracotas**, no rojos puros como `#FF0000` o `#dc2626`. La migración es principalmente un **renombre de tokens** y **refinamiento de valores**, no un cambio drástico de color.

### 📊 Mapeo real de `munay-red-*` en el código (81+ ocurrencias)

| Archivo | Líneas | Uso principal |
|---|---|---|
| `src/app/admin/flash-codes/page.tsx` | 74, 87 | Botones CTA |
| `src/app/admin/orders/[id]/page.tsx` | 190 | Link "Ver tickets" |
| `src/app/admin/page.tsx` | 76 | Badge "Panel admin" |
| `src/app/admin/tickets/page.tsx` | 209 | Link a tickets |
| `src/app/carrito/page.tsx` | 46, 88, 149, 160, 173 | Botones, precios, puntos |
| `src/app/catalogo/page.tsx` | 82, 95, 96 | Badges flash info |
| `src/app/checkout/cancelled/page.tsx` | 13, 15, 27 | Card error, botón retry |
| `src/app/checkout/page.tsx` | 91 | Botón checkout |
| `src/app/cuenta/**` | ~15 líneas | Puntos, badges, botones, órdenes |
| `src/app/flash/**` | ~10 líneas | Badges, botones, códigos |
| `src/app/info/page.tsx` | ~8 líneas | Iconos, badges informativos |
| `src/app/p/[slug]/page.tsx` | 171, 175 | Iconos de envío/verificación |
| `src/app/soporte/page.tsx` | ~6 líneas | Badges, iconos |
| `src/components/munay/**` | ~6 líneas | Header, footer, CTA, flash-offers |
| `src/components/admin/image-upload.tsx` | 269, 282 | Upload UI |
| `src/app/globals.css` | 6 | Definiciones de tokens |

### 📊 Mapeo de `--accent` (ámbar dorado, 40+ ocurrencias)

| Archivo | Uso |
|---|---|
| `src/components/cart/coupon-acknowledge.tsx` | Fondo, texto, bordes del cupón descubierto |
| `src/components/cart/loyalty-coupon-checkout.tsx` | Cards, badges, iconos de cupón |
| `src/components/cart/pending-coupon-banner.tsx` | Banner de cupón pendiente |
| `src/components/cart/cart-flash-code-input.tsx` | Código flash aplicado |
| `src/components/admin/flash-codes/flash-code-products.tsx` | Hover states |
| `src/app/cuenta/puntos/page.tsx` | Ajustes de puntos |
| `src/components/catalogo/supabase-not-configured-banner.tsx` | Banner informativo |

### 📊 Mapeo de WhatsApp `#25D366` (20 ocurrencias)

| Archivo | Uso |
|---|---|
| `src/app/checkout/page.tsx` | Botón WhatsApp, cards informativas |
| `src/app/checkout/success/page.tsx` | Botón WhatsApp, link |
| `src/app/checkout/pending/page.tsx` | Card "Pedido en proceso" |
| `src/app/checkout/cancelled/page.tsx` | Botón WhatsApp outline |
| `src/app/admin/orders/[id]/page.tsx` | Ticket WhatsApp card |
| `src/app/admin/tickets/page.tsx` | Link WhatsApp en ticket |
| `src/app/soporte/page.tsx` | Card "Contactar por WhatsApp" |

### 📊 Migraciones existentes (relevantes)

| Migración | Contenido |
|---|---|
| `00003_customers_points.sql` | ✅ Ya crea `customers` con `points_balance` |
| `00011_loyalty_coupons.sql` | ✅ Ya crea `loyalty_coupons` y `app_config` |

> **Nota:** `point_transactions` NO existe como tabla separada en las migraciones. Los puntos se manejan mediante `customers.points_balance` y `point_transactions` aún no se ha creado. Es seguro crearla.

---

## Regla de Oro

```
🎨 REGLA DE ORO MUNAY

Terracota (#C65A2E)       → Acción y urgencia moderada (botones, ofertas, CTAs)
Terracota Quemado (#A8451F) → Urgencia MÁXIMA (countdowns activos, badge LIVE, últimas unidades)
Turquesa (#2AA7A0)        → SIEMPRE confianza/verificación, NUNCA CTAs de venta
Cacao (#3B241C)           → Fondos oscuros, banners de urgencia, footer
Crema (#F6F1E8)           → Fondo general de la web
Carbón (#1E1E1E)          → Texto principal
Warm Gray (#B9B0A6)       → Bordes, divisores, UI inactiva

Ámbar Dorado (oklch(0.78 0.16 75)) → MANTENER como --accent para cupones/fidelidad
  (NO confundir con Terracota — el ámbar es para highlight de recompensas, no para CTAs)
Destructive (oklch(0.55 0.22 27)) → REEMPLAZAR por Terracota Quemado
  (Las acciones destructivas usan Terracota Quemado, no rojo externo a la paleta)

NUNCA uses rojo puro (#FF0000, #dc2626, #ef4444) en ningún componente.
WhatsApp #25D366 → Mantener como color de marca externo (NO es parte de la paleta Munay)
```

---

## Fase 1: Migración de tokens en `globals.css`

### 1.1 Nuevos tokens a añadir (CONVIVEN con los viejos)

```css
/* EN globals.css - @theme inline (NUEVOS) */
--color-munay-terracota: var(--munay-terracota);
--color-munay-terracota-quemado: var(--munay-terracota-quemado);
--color-munay-cacao: var(--munay-cacao);
--color-munay-turquesa: var(--munay-turquesa);
--color-munay-carbon: var(--munay-carbon);
--color-munay-warm-gray: var(--munay-warm-gray);
--color-munay-crema: var(--munay-crema);

/* EN :root (NUEVOS) */
--munay-terracota: #C65A2E;
--munay-terracota-quemado: #A8451F;
--munay-cacao: #3B241C;
--munay-turquesa: #2AA7A0;
--munay-carbon: #1E1E1E;
--munay-warm-gray: #B9B0A6;
--munay-crema: #F6F1E8;
```

### 1.2 Tokens viejos a mantener como `@deprecated`

```css
/* @deprecated — Usar munay-terracota-* en su lugar. Se eliminarán en v3.0 */
--munay-red-500: #f0442d;
--munay-red-600: #d92a1e;
--munay-red-800: #a3120c;
```

### 1.3 Mapeo de tokens semánticos existentes

| Token actual | Nuevo rol | ¿Cambia valor? |
|---|---|---|
| `--primary` (oklch(0.52 0.16 38)) | Se mantiene para badges semánticos ("Pagada") y CTAs secundarios. `--munay-terracota` es para CTAs primarios y elementos de marca. **Ambos coexisten con propósito distinto.** | ❌ No |
| `--accent` (ámbar dorado) | Se mantiene como color de cupones/fidelidad/recompensas | ❌ No |
| `--destructive` (rojo) | Se reemplaza por Terracota Quemado para UI. Se mantiene como variable CSS pero apunta a `--munay-terracota-quemado` visualmente. | ✅ Sí — `oklch(0.55 0.22 27)` → `#A8451F` |
| `--munay-cream` (#f3d3a6) | Se mantiene SIN CAMBIOS | ❌ No — mantener valor actual |

### 1.4 Tokenizar WhatsApp green

Crear un token para WhatsApp en vez de mantener el hex hardcodeado en 7+ archivos:

```css
/* EN @theme inline */
--color-munay-whatsapp: #25D366;

/* EN :root */
--munay-whatsapp: #25D366;
```

Luego reemplazar `bg-[#25D366]`, `text-[#25D366]`, `border-[#25D366]`, `hover:bg-[#1DA851]` por:
- `bg-munay-whatsapp`
- `text-munay-whatsapp`
- `border-munay-whatsapp`
- `hover:bg-munay-whatsapp/90`

> Este color NO es parte de la paleta Munay, sino un color de marca externo (WhatsApp).

### 1.5 Dark mode

Cada nuevo token necesita una variante dark:

| Token | Light | Dark |
|---|---|---|
| `--munay-terracota` | `#C65A2E` | `#E07B4A` (más claro) |
| `--munay-terracota-quemado` | `#A8451F` | `#C65A2E` (terracota normal en dark) |
| `--munay-cacao` | `#3B241C` | `#5C3830` (más claro) |
| `--munay-turquesa` | `#2AA7A0` | `#4DCEC7` (más claro) |
| `--munay-crema` | `#f3d3a6` | Usar `--background` dark existente |
| `--munay-warm-gray` | `#B9B0A6` | `#8A8278` (más oscuro) |

---

### Tabla find-and-replace rápida

| Buscar | → | Reemplazar | Afecta |
|---|---|---|---|
| `bg-munay-red-600` | → | `bg-munay-terracota` | 20+ archivos |
| `hover:bg-munay-red-800` | → | `hover:bg-munay-terracota-quemado` | 15+ |
| `text-munay-red-600` | → | `text-munay-terracota` | 25+ |
| `text-munay-red-600` (iconos confianza) | → | `text-munay-turquesa` | p/[slug] |
| `bg-munay-red-500/10` | → | `bg-munay-terracota/10` | ~8 |
| `bg-munay-red-500/5` | → | `bg-munay-terracota/5` | ~5 |
| `border-munay-red-500/15 /20 /30` | → | `border-munay-terracota/15 /20 /30` | ~8 |
| `from-munay-red-500 to-munay-red-800` | → | `from-munay-terracota to-munay-terracota-quemado` | 2 (cta-web, flash-offers) |
| `bg-[#25D366]` | → | `bg-munay-whatsapp` | 6+ |
| `text-[#25D366]` | → | `text-munay-whatsapp` | 5+ |
| `border-[#25D366]` | → | `border-munay-whatsapp/15 /10` | 5+ |
| `hover:bg-[#1DA851]` | → | `hover:bg-munay-whatsapp/90` | 3 |
| `focus-visible:outline-munay-red-500` | → | `focus-visible:outline-munay-terracota` | category-bar.tsx |

---

## Fase 2: Migración de componentes

### 🔴 Prioridad Alta — CTAs y botones

| Archivo | Clase actual | Clase nueva |
|---|---|---|
| `product-card.tsx` — Botón "Agregar" | `bg-munay-red-600` | `bg-munay-terracota` |
| `product-card.tsx` — Hover | `hover:bg-munay-red-800` | `hover:bg-munay-terracota-quemado` |
| `checkout/page.tsx` — Botón | `bg-munay-red-600` | `bg-munay-terracota` |
| `carrito/page.tsx` — Botones | `bg-munay-red-600` | `bg-munay-terracota` |
| `cuenta/**` — Botones | `bg-munay-red-600` | `bg-munay-terracota` |
| `flash/**` — Botones | `bg-munay-red-600` | `bg-munay-terracota-quemado` (máxima urgencia) |
| `admin/flash-codes/page.tsx` | `bg-munay-red-600` | `bg-munay-terracota` |
| Componentes Munay (header, footer, cta-web) | `text-munay-red-600` | `text-munay-terracota` |

### 🟡 Prioridad Media — Badges, etiquetas, bordes

| Archivo | Clase actual | Clase nueva |
|---|---|---|
| Badge descuento flash | `bg-munay-red-600` | `bg-munay-terracota-quemado` |
| Badge "Activo" / "Vigente" | `text-munay-red-600` | `text-munay-terracota` |
| Badge "Panel admin" | `bg-munay-red-500/10 text-munay-red-600` | `bg-munay-terracota/10 text-munay-terracota` |
| Badge de puntos | `text-munay-red-600` | `text-munay-terracota` |
| Iconos de envío/verificación (`p/[slug]`) | `text-munay-red-600` | `text-munay-turquesa` (son íconos de confianza!) |
| Hover en links de productos | `hover:text-munay-red-600` | `hover:text-munay-terracota` |
| Iconos de info/soporte | `text-munay-red-600` | `text-munay-terracota` |

### 🔵 Especial — Sello de verificación/confianza (CRÍTICO)

Actualmente los iconos `Truck` y `ShieldCheck` en `p/[slug]/page.tsx` están en `text-munay-red-600`.  
**DEBEN estar en Turquesa** porque representan confianza, no urgencia:

```tsx
// Antes (INCORRECTO - mezcla confianza con urgencia):
<Truck className="h-4 w-4 text-munay-red-600" />
<ShieldCheck className="h-4 w-4 text-munay-red-600" />

// Después (CORRECTO):
<Truck className="h-4 w-4 text-munay-turquesa" />
<ShieldCheck className="h-4 w-4 text-munay-turquesa" />
```

### 🟡 Migración de banners de oferta (urgencia visual)

| Banner actual | Banner nuevo |
|---|---|
| `bg-munay-red-500/10` + `text-munay-red-600` | `bg-munay-cacao` (SÓLIDO) + texto blanco + countdown en Terracota Quemado |

> ⚠️ Corrección de v2: `bg-munay-cacao/10` es casi invisible. Los banners deben usar **Cacao sólido** con texto blanco para mantener la urgencia visual. El countdown usa Terracota Quemado como acento.

### 🟢 Prioridad Baja — Fondos y layout

| Archivo | Clase actual | Clase nueva |
|---|---|---|
| `bg-munay-cream/*` (todos) | `bg-munay-cream/10 /20 /30` | Mantener (el valor no cambia) |
| Gradiente CTA web | `from-munay-red-500 to-munay-red-800` | `from-munay-terracota to-munay-terracota-quemado` |
| Gradiente flash-offers | `from-munay-red-500 to-munay-red-800` | `from-munay-cacao to-munay-terracota-quemado` |
| Footer | `text-munay-red-600` / `text-munay-red-800/70` | `text-munay-terracota` / `text-munay-terracota-quemado/70` |

---

## Fase 3: Nueva lógica funcional (Módulos 1-6)

> ⚠️ **IMPORTANTE:** No empezar ningún módulo funcional hasta completar Fase 1 y Fase 2 (paleta migrada).

### Módulo 1 — Sistema de Puntos y Fidelidad

**Duración:** 2-3 sesiones

#### Tablas SQL

```sql
-- 00013_loyalty_levels.sql
CREATE TABLE IF NOT EXISTS loyalty_levels (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,          -- 'bronce', 'plata', 'oro', 'andino'
  min_points INTEGER NOT NULL,        -- 0, 500, 2000, 5000
  early_access_hours INTEGER DEFAULT 0, -- 0, 6, 12, 24
  color_token TEXT NOT NULL            -- 'warm-gray', 'turquesa', 'terracota', 'cacao'
);

-- 00014_point_transactions.sql
CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  order_id UUID REFERENCES orders(id),
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'bonus', 'expire', 'referral', 'adjust')),
  points INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_point_tx_customer ON point_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_point_tx_order ON point_transactions(order_id);
```

#### Config

```typescript
// src/lib/queries/loyalty-points.ts
export interface PointsConfig {
  points_per_dollar_new: number       // 10
  points_per_dollar_used: number      // 15 (multiplicador mayor = sostenibilidad)
  points_bonus_week_sale_mult: number // 2 (x2 durante Week Sale)
  points_referral_bonus: number       // 500
  points_deferred_payment_bonus: number // 200
}
```

#### Componentes nuevos

| Componente | Descripción | Color |
|---|---|---|
| `PointsBalance` | Ícono + badge en header | Terracota hover |
| `LevelBadge` | Badge visual de nivel | Bronce: Warm Gray / Plata: Turquesa / Oro: Terracota / Andino: Cacao + Turquesa |
| `PointsHistory` | Historial en `/cuenta/puntos` | Transacciones |
| `LevelProgressBar` | "Faltan X pts para Andino" | Gradiente según nivel |

### Módulo 2 — Ofertas Flash / Week Sale

**Duración:** 1-2 sesiones

#### Migración visual de banners

```
ANTES: bg-munay-red-500/10 + text-munay-red-600 + border-munay-red-500/20
DESPUÉS: bg-munay-cacao/10 + text-munay-terracota-quemado + border-terracota-quemado/20
```

#### Modelo de datos

```typescript
export interface Campaign {
  id: string
  name: string
  type: 'flash' | 'week_sale'
  starts_at: string
  ends_at: string
  product_ids: string[]
  points_multiplier: number
  discount_percent: number | null
  status: 'pending' | 'active' | 'ended'
}
```

### Módulo 3 — Week Buy

**Duración:** 2 sesiones

#### Estados visuales

- **ESTADO A (sin campaña):** Banner en Turquesa tenue ("Próximo Week Buy: [categoría]. Notificarme")
- **ESTADO B (campaña activa):** Banner en Cacao con acentos Terracota Quemado, countdown, formulario

### Módulo 4 — Códigos en Vivo

**Duración:** 1-2 sesiones

#### Migración visual

```
ANTES: borde rojo, texto rojo, botón rojo
DESPUÉS: borde Warm Gray, texto código en Terracota, botón "Copiar" en Terracota sólido
Badge "LIVE": Terracota Quemado con animación pulso (media query prefers-reduced-motion)
```

### Módulo 5 — Marketplace P2P

**Duración:** 1-2 sesiones

- Botón "Publicar prenda" en nav → Terracota
- Badge de verificación → Turquesa (SIEMPRE)

### Módulo 6 — Elementos transversales de UI

| Componente | Especificación |
|---|---|
| `<CountdownTimer fechaFin={} />` | Fondo Cacao, números Terracota Quemado/blanco |
| `<StockBadge cantidadRestante={} />` | Texto Terracota, fondo Crema, borde Warm Gray |
| `<TrustBadge tipo="higiene" />` | SIEMPRE Turquesa, círculo con check |
| `<LiveCodeCard codigo={} />` | Borde Warm Gray, código Terracota, contador usos Cacao |
| `<LevelBadge nivel={} />` | Bronce: Warm Gray / Plata: Turquesa / Oro: Terracota / Andino: Cacao + Turquesa |

---

## Fase 4: Verificación y QA

### Checklist de accesibilidad (WCAG AA)

| Combinación | Ratio estimado | ¿Pasa AA? | Restricción |
|---|---|---|---|
| Blanco sobre Cacao (#3B241C) | ~12.5:1 | ✅ Sí (AAA!) | Sin restricción |
| Blanco sobre Terracota Quemado (#A8451F) | ~4.8:1 | ⚠️ Solo para ≥18px | Usar solo para headings o decorativo |
| Terracota (#C65A2E) sobre Crema (#f3d3a6) | ~3.8:1 | ❌ No para texto <18px | Usar solo para elementos grandes o iconos |
| Carbón (#1E1E1E) sobre Crema (#f3d3a6) | ~11.2:1 | ✅ Sí | Sin restricción |
| Blanco sobre Terracota (#C65A2E) | ~6.1:1 | ✅ Sí | Sin restricción |

### Checklist de verificación visual

- [ ] **No queda ningún `bg-munay-red-500/600/800`** en el código
- [ ] **No queda ningún rojo puro** (#FF0000, #dc2626, #ef4444)
- [ ] **Iconos de confianza (Truck, ShieldCheck) están en Turquesa** en `p/[slug]`
- [ ] **Badge "LIVE" está en Terracota Quemado** con animación de pulso
- [ ] **CTAs principales están en Terracota** (#C65A2E)
- [ ] **WhatsApp #25D366 se mantiene** como color externo (no parte de paleta)
- [ ] **Dark mode probado** con todos los nuevos tokens
- [ ] **Sistema de niveles funciona** con umbrales definidos
- [ ] **Ofertas Flash conectadas** a datos reales
- [ ] **Contraste WCAG AA** verificado en todas las combinaciones de la tabla arriba

---

## Orden de implementación recomendado

| Orden | Trabajo | Rama | Duración |
|:---:|---|---|---:|
| 1° | **Fase 1**: Añadir tokens + dark mode en globals.css | `redesign-v2-palette` | 30 min |
| 2° | **Fase 2 🔴**: Migrar CTAs y botones (prioridad alta) | `redesign-v2-palette` | 1 sesión |
| 3° | **Fase 2 🟡**: Migrar badges y etiquetas | `redesign-v2-palette` | 1 sesión |
| 4° | **Fase 2 🔵**: Corregir sello verificación a Turquesa | `redesign-v2-palette` | 15 min |
| 5° | **Fase 2 🟢**: Migrar fondos y gradientes | `redesign-v2-palette` | 30 min |
| 6° | **Fase 4**: QA visual + contraste | `redesign-v2-palette` | 30 min |
| 7° | Merge `redesign-v2-palette` → `master` | — | — |
| 8° | **Módulo 1**: Sistema de Puntos | `feat/points-system` | 2-3 sesiones |
| 9° | **Módulo 2**: Ofertas Flash | `feat/flash-campaigns` | 1-2 sesiones |
| 10° | **Módulo 4**: Códigos en Vivo | `feat/live-codes` | 1-2 sesiones |
| 11° | **Módulo 3**: Week Buy | `feat/week-buy` | 2 sesiones |
| 12° | **Módulo 5**: Marketplace P2P | `feat/marketplace-p2p` | 1-2 sesiones |
| 13° | **Módulo 6**: Componentes UI | `feat/ui-components` | 1 sesión |
| 14° | **Fase final**: QA completo + deploy | `master` | 1 sesión |

---

## Estrategia de reversibilidad

```bash
# Cada grupo de cambios en su propia rama
git checkout -b redesign-v2-palette
# Fase 1: tokens
git commit -m "feat(palette): añadir tokens terracota, cacao, turquesa, carbon, warm-gray"
# Fase 2: migración componentes
git commit -m "refactor(palette): migrar CTAs y botones a terracota"
git commit -m "refactor(palette): migrar badges y etiquetas"
git commit -m "fix(palette): restaurar sello verificación a turquesa"
git commit -m "refactor(palette): migrar fondos y layout"

# Para revertir TODO (antes de merge a master):
git revert HEAD~4..HEAD

# Módulos funcionales van en ramas separadas
git checkout -b feat/points-system
git checkout -b feat/flash-campaigns
# etc.
```

---

## Resumen de hallazgos vs plan original

| Hallazgo del revisor | Acción en el plan |
|---|---|
| `--accent` (ámbar dorado) sin mapeo | ✅ Mantener como color de cupones/fidelidad |
| `#f3d3a6` → `#F6F1E8` no es "ajuste leve" | ✅ Mantener valor actual (#f3d3a6) sin cambios |
| `--destructive` sin mapeo | ✅ Reemplazar por Terracota Quemado |
| Blanco sobre Cacao falla WCAG AA | ✅ Documentado: pasa AA (12.5:1) |
| Blanco sobre Terracota Quemado falla AA | ✅ Documentado: solo para ≥18px |
| Dark mode no cubierto | ✅ Añadida tabla de variantes dark |
| `point_transactions` puede ya existir | ✅ Verificado: no existe, seguro crearla |
| WhatsApp `#25D366` no mencionado | ✅ Documentado como excepción externa a la paleta |
| Niveles sin umbrales ni progresión | ✅ Añadidos thresholds + LevelProgressBar |
| Rama mezcla paleta + funcional | ✅ Separado en ramas distintas |
