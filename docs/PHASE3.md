# FASE 3/5 — Pasarela PCI + Órdenes + Webhooks + Puntos

**Objetivo:** permitir pagos reales con tarjeta, creación de órdenes en Supabase,
confirmación asíncrona vía webhooks y acreditación automática de puntos.

---

## Modos de operación

El adapter de pago (`src/lib/payments/kushki.ts`) detecta automáticamente el modo:

| Modo | Cuándo | Comportamiento |
|------|--------|----------------|
| `demo` | No hay credenciales Kushki | Simula el pago: captura inmediata, sin llamada real |
| `sandbox` | `KUSHKI_*_KEY` presentes + `PAYMENT_SANDBOX=true` | Llama a `api-uat.kushkipagos.com` |
| `production` | `KUSHKI_*_KEY` presentes + `PAYMENT_SANDBOX=false` | Llama a `api.kushkipagos.com` |

**Para activar sandbox/production:** copia tus credenciales de Kushki en `.env.local`:
```bash
PAYMENT_PROVIDER=kushki
PAYMENT_SANDBOX=true
KUSHKI_PUBLIC_KEY=...
KUSHKI_PRIVATE_KEY=...
KUSHKI_WEBHOOK_SECRET=...
```

---

## Arquitectura del flujo de pago

```
[Usuario en /checkout]
        │
        │ 1. Submit form (email + envío + tarjeta)
        ▼
[POST /api/orders]
   ├─ Valida items + stock
   ├─ consume_flash_code()  ← RPC atómica (SELECT FOR UPDATE)
   ├─ Calcula subtotal, descuento, puntos
   ├─ INSERT orders + order_items
   ├─ reserve_inventory()   ← RPC atómica por item
   └─ Retorna order_id
        │
        │ 2. Continúa con el pago
        ▼
[POST /api/payments/create]
   ├─ Verifica orden = 'pending'
   ├─ INSERT payments (status=pending)
   ├─ createPayment() → Kushki API o demo
   ├─ UPDATE payments (provider_ref, status)
   ├─ Si captured inmediato → markOrderPaid()
   └─ Retorna redirect_url
        │
        │ 3a. Modo demo: redirect a /checkout/success
        │ 3b. Modo real: redirect a pasarela → webhook
        ▼
[POST /api/payments/webhook]  (asíncrono, desde Kushki)
   ├─ Verifica firma HMAC (KUSHKI_WEBHOOK_SECRET)
   ├─ parseKushkiWebhook(body)
   ├─ Idempotencia: si ya está paid, no hace nada
   ├─ Si status=captured:
   │   ├─ UPDATE orders SET status='paid'
   │   ├─ UPDATE payments SET status='captured'
   │   ├─ commit_inventory() por item  ← decrementa stock
   │   └─ award_points()  ← RPC idempotente
   └─ Si status=failed:
       ├─ UPDATE orders SET status='cancelled'
       └─ release_inventory() por item  ← libera reservado
```

---

## RPCs atómicas (migración 00007)

### `consume_flash_code(p_code)`
Consume 1 uso de un código flash de forma atómica (SELECT FOR UPDATE + UPDATE en la misma transacción).
Retorna `{ ok, code, type, discount_percent, discount_cents }` o `{ ok: false, reason }`.

### `reserve_inventory(p_product_id, p_qty)`
Reserva `qty` unidades (incrementa `reserved`). No permite `reserved > stock`.

### `commit_inventory(p_product_id, p_qty)`
Concreta la venta: decrementa `stock` y `reserved`. Se llama al confirmar el pago.

### `release_inventory(p_product_id, p_qty)`
Libera una reserva (decrementa `reserved` sin tocar `stock`). Se llama si el pago falla.

### `award_points(p_order_id)`
Acredita puntos al customer de una orden paid. **Idempotente**: si ya existe tx `earn` para esa orden, no duplica.
- Busca o crea customer por email.
- Calcula `puntos = floor(total_cents / 100)`.
- INSERT en `point_transactions` con type='earn'.

---

## Endpoints nuevos en Fase 3

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/orders` | Crea orden pending + items + reserva inventario |
| POST | `/api/payments/create` | Llama a la pasarela con el order_id |
| POST | `/api/payments/webhook` | Recibe confirmación asíncrona de Kushki |
| GET | `/api/payments/webhook` | Health check |

### POST /api/orders

**Body:**
```json
{
  "items": [{ "product_id": "uuid", "qty": 2 }],
  "customer_email": "cliente@email.com",
  "customer_name": "Nombre",
  "shipping": { "name", "address", "city", "province", "phone" },
  "flash_code": "MUNAY10",
  "points_to_redeem": 0
}
```

**Response 200:**
```json
{
  "ok": true,
  "order_id": "uuid",
  "subtotal_cents": 5000,
  "discount_cents": 500,
  "points_redeemed": 0,
  "total_cents": 4500,
  "currency": "USD"
}
```

**Errores:** `invalid_input` (400), `product_not_found`/`insufficient_stock`/`flash_invalid`/`points_invalid` (422), `no_supabase` (503), `internal_error` (500).

### POST /api/payments/create

**Body:** `{ "order_id": "uuid", "card_token": "..." }`

**Response 200:**
```json
{
  "ok": true,
  "payment_id": "uuid",
  "provider_ref": "demo-...",
  "status": "captured",
  "mode": "demo",
  "redirect_url": "/checkout/success?order=uuid"
}
```

### POST /api/payments/webhook

**Headers esperados (Kushki):**
- `X-Kushki-Signature` (HMAC-SHA256 del body con `KUSHKI_WEBHOOK_SECRET`)
- `Content-Type: application/json`

**Body (ejemplo Kushki):**
```json
{
  "ticketNumber": "1234567890",
  "transactionStatus": "APPROVAL",
  "amount": { "total": 45.00, "currency": "USD" },
  "metadata": { "order_id": "uuid" }
}
```

**Respuesta:** `{ "ok": true }` con status 200. Idempotente.

---

## Páginas nuevas

| Ruta | Descripción |
|------|-------------|
| `/checkout` | Form completo: datos + envío + tarjeta → crea orden → paga |
| `/checkout/success` | Confirmación con puntos ganados |
| `/checkout/cancelled` | Pago fallido/cancelado |
| `/checkout/pending` | Pago en proceso (esperando webhook) |
| `/admin/orders` | Listado de órdenes con filtros por estado |
| `/admin/orders/[id]` | Detalle: items, pagos, envío, resumen financiero |

### Stats del panel admin

- Total productos + activos
- Total órdenes + pagadas
- **Ingresos totales** (suma de `total_cents` de órdenes `paid`)
- **Conversión** (% pagadas / total)

---

## Cómo probar el flujo completo (modo demo)

1. Configura Supabase con las 7 migraciones aplicadas.
2. Crea un usuario admin (ver Fase 2).
3. Agrega productos desde `/admin/products/new`.
4. Visita `/catalogo`, agrega piezas al carrito.
5. Aplica un código flash (ej: `MUNAY10` para 10% off).
6. Ve a `/checkout`, completa el form con cualquier email y tarjeta de prueba.
7. Click en "Pagar" → se crea la orden → se simula el pago → redirect a `/checkout/success`.
8. Verifica en `/admin/orders` que la orden aparezca como "Pagada" con los puntos acreditados.

### Códigos flash de prueba (seed)

- `MUNAY10` → 10% descuento en todo el catálogo.
- `MUNAY25` → 25% descuento.
- `SECRETO` → desbloquea pieza oculta.

---

## Activar Kushki real (sandbox)

1. Crea cuenta merchant en [kushki.com](https://kushki.com).
2. Obtén credenciales de sandbox: Dashboard → Developers → API Keys.
3. Configura el webhook: Dashboard → Developers → Webhooks →
   - URL: `https://tudominio.com/api/payments/webhook`
   - Eventos: `APPROVAL_TRANSACTION`, `DECLINED_TRANSACTION`, `REFUND_TRANSACTION`
   - Copia el `Webhook Secret`.
4. Completa `.env.local`:
   ```bash
   PAYMENT_PROVIDER=kushki
   PAYMENT_SANDBOX=true
   KUSHKI_PUBLIC_KEY=tu-public-merchant-id-sandbox
   KUSHKI_PRIVATE_KEY=tu-private-secret-key-sandbox
   KUSHKI_WEBHOOK_SECRET=tu-webhook-secret
   ```
5. Reinicia el dev server. El badge en `/checkout` ahora dirá "pasarela kushki sandbox".
6. Para producción: cambia `PAYMENT_SANDBOX=false` y usa credenciales de producción.

### Tarjetas de prueba Kushki (sandbox)

Visa aprobada: `4111111111111111` (cualquier vencimiento futuro, CVC 123)
Mastercard aprobada: `5111111111111111`
Visa declinada: `4999991111111111`

Más en: https://docs.kushki.com/docs/tarjetas-de-prueba

---

## Seguridad implementada

- **Precios del backend:** el cliente nunca envía precios; se leen de la DB al crear la orden.
- **Stock atómico:** `reserve_inventory` usa `SELECT FOR UPDATE` para evitar overselling.
- **Flash codes atómicos:** `consume_flash_code` evita exceder `max_uses` con compras concurrentes.
- **Webhook firmado:** verificación HMAC con `KUSHKI_WEBHOOK_SECRET`.
- **Idempotencia:** `award_points` no duplica puntos si el webhook se recibe 2 veces.
- **Service role aislado:** todas las escrituras usan `createAdminClient()`, nunca expuesto al navegador.
- **Guest checkout:** no requiere login; el `user_id` se asocia solo si hay sesión.

---

## Estructura de archivos nuevos en Fase 3

```
src/
├── app/
│   ├── admin/orders/
│   │   ├── page.tsx                    # Listado de órdenes
│   │   └── [id]/page.tsx               # Detalle de orden
│   ├── api/
│   │   ├── orders/route.ts             # POST crear orden
│   │   └── payments/
│   │       ├── create/route.ts         # POST iniciar pago
│   │       └── webhook/route.ts        # POST webhook (público)
│   └── checkout/
│       ├── page.tsx                    # Reescrito con flujo completo
│       ├── success/page.tsx            # Confirmación
│       ├── cancelled/page.tsx          # Cancelado
│       └── pending/page.tsx            # En proceso
├── lib/
│   ├── orders.ts                       # createOrder, markOrderPaid, markOrderCancelled
│   └── payments/kushki.ts              # Adapter: createPayment, verifyWebhook, parseWebhook
└── supabase/migrations/
    └── 00007_rpc_atomic_operations.sql # consume_flash_code, inventory, award_points
```

---

## Siguiente: Fase 4/5

- Cuenta de usuario final: `/cuenta` con login real (Supabase Auth).
- Historial de órdenes del cliente.
- Balance de puntos + redención en checkout.
- Panel admin: gestión de flash codes (CRUD).
- Panel admin: métricas avanzadas (ventas por día, productos más vendidos).
- Cloudflare Turnstile en `/checkout` y validación de flash codes.
