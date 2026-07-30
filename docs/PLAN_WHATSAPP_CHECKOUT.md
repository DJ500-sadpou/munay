# Plan: WhatsApp Checkout — Reemplazo de pago con tarjeta

## Objetivo
Eliminar el pago con tarjeta (Kushki) del flujo de checkout. Al hacer clic en "Pagar", el sistema crea una **orden** + un **ticket** y redirige al usuario a WhatsApp con un mensaje formateado con los detalles del pedido. El pago se coordina por WhatsApp.

## Flujo nuevo

```
Usuario llena checkout (datos + envío)
  → Clic "Enviar pedido por WhatsApp"
    → POST /api/orders (crea orden en DB, status='pending')
    → POST /api/tickets (crea ticket ligado a la orden, status='new')
    → Redirige a WhatsApp con mensaje formateado
      → Dueño recibe el pedido en WhatsApp
        → Coordina pago por WhatsApp con el cliente
          → Admin marca orden como 'paid' manualmente en /admin/orders
```

---

## Fase 0: Migración SQL — Tabla tickets mejorada

**Archivo:** `supabase/migrations/00010_tickets_whatsapp.sql`

```sql
-- Migrar tabla tickets para soportar pedidos vía WhatsApp
CREATE TABLE IF NOT EXISTS public.tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  message     TEXT NOT NULL,
  items       JSONB,        -- snapshot de los productos del pedido
  status      TEXT NOT NULL DEFAULT 'new'
              CHECK (status IN ('new','in_progress','completed','cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON public.tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
```

**Ejecutar en Neon SQL Editor.**

---

## Fase 1: Endpoint POST /api/checkout/whatsapp

**Archivo nuevo:** `src/app/api/checkout/whatsapp/route.ts`

Propósito: endpoint unificado que:
1. Recibe: items, customer info, shipping info, flash_code, loyalty_code, points_to_redeem
2. Llama a `createOrder()` (existente en `orders-neon.ts`) para crear la orden
3. Inserta un ticket en `tickets` con:
   - order_id
   - Datos del cliente (name, email, phone)
   - Mensaje formateado con el resumen del pedido
   - items: snapshot JSON de los productos
4. Construye mensaje de WhatsApp con los datos
5. Retorna: `{ ok: true, order_id, ticket_id, whatsapp_url }`

**Mensaje de WhatsApp:**
```
🛍️ *Nuevo pedido - Munay*

👤 *Nombre:* {name}
📧 *Email:* {email}
📱 *Teléfono:* {phone}

📦 *Productos:*
{• Camiseta × 2 — $36.00
 • Mystery Box × 1 — $25.00}

🏠 *Dirección:* {address}, {city}, {province}
💰 *Subtotal:* $61.00
🏷️ *Descuento:* -$5.00
🚚 *Envío:* $2.00
💵 *Total:* $58.00

🆔 *Orden:* abc123...
📋 *Ticket:* tkt-xyz...
```

---

## Fase 2: Modificar checkout page (src/app/checkout/page.tsx)

Cambios:
1. **Eliminar sección "Pago con tarjeta"** (todo el Card de credit card)
2. **Modificar el botón submit:**
   - Texto: "📱 Enviar pedido por WhatsApp"
   - Icono: MessageCircle en vez de CreditCard
   - On submit: llama a POST /api/checkout/whatsapp en vez de /api/orders + /api/payments/create
3. **Mensaje de información:** reemplazar "Pago seguro con Kushki" por "Te contactaremos por WhatsApp para coordinar el pago"
4. **Eliminar imports no usados:** CreditCard, Lock, ShieldCheck, etc.
5. **Estados:**
   - `form` → formulario normal
   - `sending` → enviando pedido
   - `redirecting` → redirigiendo a WhatsApp
   - `error` → error

---

## Fase 3: Modificar checkout success page (src/app/checkout/success/page.tsx)

Cambios:
1. **Título:** "¡Pedido enviado por WhatsApp!" en vez de "Pago confirmado"
2. **Mensaje:** "Hemos recibido tu pedido. Un asesor te contactará por WhatsApp para coordinar el pago y el envío."
3. **Botón:** "Abrir conversación en WhatsApp" que abre el enlace directo
4. **Mantener:** mostrar orden ID, total, productos
5. **Eliminar:** referencia a "pago", "email de confirmación", etc.

---

## Fase 4: Admin — Panel de tickets

**Archivo nuevo:** `src/app/admin/tickets/page.tsx`

Lista de tickets con:
- ID, cliente, email, teléfono, estado, fecha
- Filtro por estado (new, in_progress, completed, cancelled)
- Acción: marcar como "in_progress", "completed", "cancelled"

**API nuevo:** `PATCH /api/admin/tickets/[id]/route.ts`
- Body: `{ status: 'in_progress' | 'completed' | 'cancelled' }`
- Admin auth + UPDATE tickets SET status

**Navbar admin:** agregar link a "Tickets" en el menú.

---

## Fase 5: Admin — Botón "Marcar como pagada" en orden

**Modificar:** `src/app/admin/orders/[id]/page.tsx`

Agregar botón "Marcar como pagada" para órdenes en estado `pending`:
- Llama a `POST /api/admin/orders/[id]/mark-paid`
- El endpoint usa `markOrderPaid()` existente
- Esto permite al admin marcar manualmente cuando el pago se confirma por WhatsApp

**API nuevo:** `POST /src/app/api/admin/orders/[id]/mark-paid/route.ts`
- Admin auth
- Llama a `markOrderPaid(orderId, 'whatsapp-manual-' + Date.now())`

---

## Fase 6: Typecheck + Revisión + Deploy

1. Typecheck (`npm run typecheck`)
2. Revisar con code-reviewer-deepseek-flash
3. Commit + push a GitHub
4. Desplegar a Vercel (producción)
5. Ejecutar migración SQL en Neon

---

## Archivos creados (5)

| Archivo | Fase |
|:---|---:|
| `src/app/api/checkout/whatsapp/route.ts` | 1 |
| `src/app/api/admin/tickets/[id]/route.ts` | 4 |
| `src/app/app/admin/tickets/page.tsx` | 4 |
| `src/app/api/admin/orders/[id]/mark-paid/route.ts` | 5 |
| `supabase/migrations/00010_tickets_whatsapp.sql` | 0 |

## Archivos modificados (4)

| Archivo | Fase |
|:---|---:|
| `src/app/checkout/page.tsx` | 2 |
| `src/app/checkout/success/page.tsx` | 3 |
| `src/app/admin/layout.tsx` (navbar) | 4 |
| `src/app/admin/orders/[id]/page.tsx` | 5 |
