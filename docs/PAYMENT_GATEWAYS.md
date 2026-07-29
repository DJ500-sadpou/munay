# Pasarelas de pago para Ecuador (Ibarra)

Comparativa para decidir la integración de la **Fase 3/5**. La decisión se
configura vía la variable de entorno `PAYMENT_PROVIDER` en `.env.example`.

---

## Opción A — Kushki (recomendada) ✅

**Por qué:** es la pasarela con mejor cobertura para tarjeta local en Ecuador.
Sopta débito y crédito de todos los bancos ecuatorianos, tokenización, webhooks
y checkout embebido.

### Pros
- Cobertura completa de tarjetas ecuatorianas (Visa, Mastercard, Amex, Diners).
- Checkout embebido (no redirige al usuario fuera del sitio).
- Tokenización de tarjeta (para "pagar con 1 click" en el futuro).
- Webhooks firmados (verificables con `KUSHKI_WEBHOOK_SECRET`).
- Sandbox completo con tarjetas de prueba.
- Soporte en español, atención local.

### Contras
- Comisión por transacción (~2.99% + $0.30 aprox., verificar con tu account manager).
- Requiere KYC completo de la empresa/registro único de contribuyentes (RUC).
- Acreditación T+2 a T+5 días hábiles.

### Documentación oficial
- Portal: https://docs.kushki.com
- Referencia API: https://docs.kushki.com/docs/api-referencia
- Webhooks: https://docs.kushki.com/docs/webhooks
- Checkout embebido (front): https://docs.kushki.com/docs/checkout-web
- Tarjetas de prueba: https://docs.kushki.com/docs/tarjetas-de-prueba

### Credenciales necesarias (sandbox)
```
KUSHKI_PUBLIC_KEY=...
KUSHKI_PRIVATE_KEY=...
KUSHKI_WEBHOOK_SECRET=...
```

### Flujo de integración (Fase 3)
1. Frontend tokeniza tarjeta con Kushki.js (embebido en `/checkout`).
2. Backend (Server Action / Route Handler) recibe el token + monto.
3. Backend crea la orden en Supabase + llama a `POST /v1/charges` con `KUSHKI_PRIVATE_KEY`.
4. Kushki responde con `ticketNumber` y estado.
5. Backend guarda el `payment` en Supabase con `provider_ref = ticketNumber`.
6. Webhook `POST /api/payments/webhook` recibe confirmación asíncrona → marca orden como `paid` + acredita puntos.

---

## Opción B — PayPhone

**Por qué:** alternativa local fuerte en Ecuador. Útil si tu operación encaja
con su modelo (tiendas físicas + online).

### Pros
- Empresa ecuatoriana, soporte 100% local.
- Buena integración con bancos locales.
- App móvil para gestión.
- Sin monthly fee, solo comisión por transacción.

### Contras
- UX de checkout diferente (redirige a página de PayPhone).
- API menos moderna que Kushki.
- Documentación técnica más escueta.
- Menos flexible para casos edge (suscripciones, tokenización avanzada).

### Documentación oficial
- Portal: https://payphone.app
- Docs API: https://developer.payphone.app
- Sandboxes y pruebas: https://developer.payphone.app/docs/pruebas

### Credenciales necesarias
```
PAYPHONE_TOKEN=...
PAYPHONE_STORE_ID=...
```

### Flujo de integración
1. Backend crea la orden en Supabase.
2. Backend llama a `POST /api/Prepare` con monto + `store_id`.
3. PayPhone devuelve un `paymentId` + URL de redirección.
4. Frontend redirige al usuario a PayPhone.
5. Tras el pago, PayPhone redirige de vuelta a `/checkout/success` con el `paymentId`.
6. Webhook `POST /api/payments/webhook` confirma el pago asíncronamente.

---

## Opción C — PayPal Checkout (fallback global)

**Por qué:** opción de respaldo si Kushki/PayPhone no son viables. Útil para
clientes internacionales o con cuenta PayPal.

### Pros
- Reconocimiento de marca global.
- Acepta tarjetas internacionales y saldo PayPal.
- Checkout en español, soporta USD.
- Sandbox completo (PayPal Sandbox).

### Contras
- UX de checkout redirige fuera del sitio (PayPal-hosted).
- Comisión ~4.4% + $0.30 (más alta que Kushki/PayPhone).
- Acreditación T+0 si el cliente paga con saldo PayPal, T+1 a T+3 si con tarjeta.
- Requisito de cuenta business verificada (KYC internacional).

### Documentación oficial
- Portal: https://developer.paypal.com
- Checkout (REST): https://developer.paypal.com/docs/api/orders/v2
- Webhooks: https://developer.paypal.com/api/rest/webhooks
- Tarjetas de prueba: https://developer.paypal.com/tools/sandbox/card-testing

### Credenciales necesarias
```
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
```

### Flujo de integración
1. Frontend crea la orden de PayPal con el SDK JS (`createOrder`).
2. Backend (Server Action) captura la orden con `PAYPAL_CLIENT_SECRET`.
3. Backend guarda el `payment` en Supabase con `provider_ref = paypal_order_id`.
4. Webhook `POST /api/payments/webhook` verifica el evento `CHECKOUT.ORDER.APPROVED`.

---

## Comparativa rápida

| Criterio | Kushki | PayPhone | PayPal |
|----------|--------|----------|--------|
| Cobertura tarjeta local EC | ★★★★★ | ★★★★ | ★★ |
| UX (sin redirección) | ★★★★★ | ★★ | ★★ |
| Comisión | ~3% | ~3% | ~4.4% |
| Documentación | ★★★★ | ★★★ | ★★★★★ |
| Soporte local EC | ★★★★ | ★★★★★ | ★★ |
| Integración técnica | Moderna, REST + SDK | REST, más simple | REST + SDK |
| Tiempo acreditación | T+2 a T+5 | T+1 a T+3 | T+0 a T+3 |
| Recomendado para | MVP + escala | Si encaja en su red | Fallback internacional |

---

## Recomendación para Munay

**Kushki como proveedor principal** porque:
1. Mejor cobertura de tarjetas locales (cliente final no necesita cuenta PayPal).
2. Checkout embebido → UX más fluida/coherente con la marca (sin redirecciones).
3. Tokenización abre la puerta a "pagar con 1 click" en fases posteriores.
4. Webhooks firmados → seguridad verificable.

**PayPal como fallback** (activable vía `PAYMENT_PROVIDER=paypal`) para clientes
internacionales que compren desde fuera de Ecuador.

---

## Configuración del proveedor en el código

```ts
// src/lib/constants.ts
export const PAYMENT = {
  provider: (process.env.PAYMENT_PROVIDER ?? 'kushki') as 'kushki' | 'payphone' | 'paypal',
  sandbox: process.env.PAYMENT_SANDBOX === 'true',
}
```

```bash
# .env.example
PAYMENT_PROVIDER=kushki
PAYMENT_SANDBOX=true
KUSHKI_PUBLIC_KEY=...
KUSHKI_PRIVATE_KEY=...
KUSHKI_WEBHOOK_SECRET=...
```

Cambiar de proveedor solo requiere cambiar variables de entorno + implementar
el adapter correspondiente en `src/lib/payments/` (Fase 3).

---

## Próximos pasos (Fase 3)

1. Crear `src/lib/payments/kushki.ts` (adapter).
2. Crear `src/app/api/payments/create/route.ts` (Server-side).
3. Crear `src/app/api/payments/webhook/route.ts` (Handler público).
4. Implementar Kushki.js en `/checkout` para tokenización.
5. Edge Function en Supabase para acreditar puntos cuando webhook confirme `paid`.
