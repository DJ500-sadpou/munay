/**
 * Adapter de pago — abstracción sobre la pasarela elegida.
 *
 * Soporta 3 modos:
 *   - 'demo'    : simula el flujo completo sin llamar a Kushki (sin credenciales).
 *   - 'sandbox' : llama a Kushki sandbox (credenciales de prueba).
 *   - 'production' : llama a Kushki producción.
 *
 * El modo se determina por variables de entorno:
 *   PAYMENT_PROVIDER=kushki (default)
 *   PAYMENT_SANDBOX=true|false
 *   KUSHKI_PUBLIC_KEY / KUSHKI_PRIVATE_KEY presentes
 *
 * Si no hay credenciales Kushki, cae a 'demo' automáticamente.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { PAYMENT } from '@/lib/constants'

export type PaymentMode = 'demo' | 'sandbox' | 'production'

export interface PaymentCreateInput {
  order_id: string
  amount_cents: number
  currency: string  // 'USD'
  customer_email: string
  customer_name: string
  // Token de tarjeta devuelto por Kushki.js en el frontend
  card_token?: string
  // Metadata para auditoría
  description: string
  metadata?: Record<string, unknown>
}

export interface PaymentCreateResult {
  ok: boolean
  // ID interno del pago en nuestra DB
  payment_id?: string
  // Referencia de la pasarela (ticketNumber en Kushki)
  provider_ref?: string
  // Estado inicial
  status: 'pending' | 'authorized' | 'captured' | 'failed'
  // URL de redirección si la pasarela requiere redirect (PayPhone/PayPal)
  redirect_url?: string
  // Mensaje de error si aplica
  error?: string
  // Modo utilizado (para logs)
  mode: PaymentMode
}

export interface WebhookVerifyResult {
  valid: boolean
  order_id?: string
  provider_ref?: string
  status?: 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded'
  raw?: Record<string, unknown>
  reason?: string
}

// -----------------------------------------------------------
// Detección de modo
// -----------------------------------------------------------

export function detectPaymentMode(): PaymentMode {
  if (process.env.KUSHKI_PUBLIC_KEY && process.env.KUSHKI_PRIVATE_KEY) {
    return PAYMENT.sandbox ? 'sandbox' : 'production'
  }
  return 'demo'
}

// -----------------------------------------------------------
// Implementación DEMO
// -----------------------------------------------------------

/**
 * En modo demo:
 *   - Acepta cualquier card_token no vacío.
 *   - Crea el payment con status 'captured' inmediatamente.
 *   - provider_ref = 'demo-' + random.
 *   - El webhook se simula desde el frontend llamando a /api/payments/webhook.
 */
async function createDemoPayment(input: PaymentCreateInput): Promise<PaymentCreateResult> {
  await new Promise((r) => setTimeout(r, 800)) // simular latencia

  const provider_ref = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return {
    ok: true,
    provider_ref,
    status: 'captured', // en demo asumimos captura inmediata
    mode: 'demo',
  }
}

// -----------------------------------------------------------
// Implementación KUSHKI (sandbox/production)
// -----------------------------------------------------------

const KUSHKI_API_URLS = {
  sandbox: 'https://api-uat.kushkipagos.com',
  production: 'https://api.kushkipagos.com',
} as const

/**
 * Llama al endpoint /v1/charges de Kushki.
 * Doc: https://docs.kushki.com/docs/api-referencia#cargo
 *
 * Body esperado por Kushki:
 *   {
 *     "token": "<card_token from Kushki.js>",
 *     "amount": { "subtotalIva": 0, "subtotalIva0": 18.00, "iva": 0, "currency": "USD" },
 *     "metadata": { "order_id": "..." },
 *     "contactDetails": { "email": "...", "firstName": "..." },
 *     "orderDetails": { "siteDomain": "munay.example.com" }
 *   }
 *
 * Headers:
 *   Private-Merchant-Id: <KUSHKI_PRIVATE_KEY>
 */
async function createKushkiPayment(
  input: PaymentCreateInput,
  mode: 'sandbox' | 'production'
): Promise<PaymentCreateResult> {
  const baseUrl = KUSHKI_API_URLS[mode]
  const privateKey = process.env.KUSHKI_PRIVATE_KEY

  if (!privateKey) {
    return {
      ok: false,
      status: 'failed',
      mode,
      error: 'Falta KUSHKI_PRIVATE_KEY en variables de entorno.',
    }
  }

  if (!input.card_token) {
    return {
      ok: false,
      status: 'failed',
      mode,
      error: 'Falta card_token (tokenización Kushki.js).',
    }
  }

  // Kushki espera monto en dólares (float), no centavos
  const amountUsd = (input.amount_cents / 100).toFixed(2)

  const body = {
    token: input.card_token,
    amount: {
      subtotalIva: 0,
      subtotalIva0: Number(amountUsd),
      iva: 0,
      currency: input.currency,
    },
    metadata: {
      order_id: input.order_id,
      ...input.metadata,
    },
    contactDetails: {
      email: input.customer_email,
      firstName: input.customer_name,
    },
    orderDetails: {
      siteDomain: process.env.NEXT_PUBLIC_SITE_URL ?? 'localhost',
    },
  }

  try {
    const res = await fetch(`${baseUrl}/v1/charges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Private-Merchant-Id': privateKey,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      return {
        ok: false,
        status: 'failed',
        mode,
        error: data.message ?? `Kushki error ${res.status}`,
      }
    }

    // Kushki retorna: { token, ticketNumber, approvedTransaction }
    return {
      ok: true,
      provider_ref: data.ticketNumber ?? data.token,
      status: data.approvedTransaction === true ? 'captured' : 'pending',
      mode,
    }
  } catch (err: any) {
    return {
      ok: false,
      status: 'failed',
      mode,
      error: err?.message ?? 'Error de conexión con Kushki',
    }
  }
}

// -----------------------------------------------------------
// API pública
// -----------------------------------------------------------

export async function createPayment(input: PaymentCreateInput): Promise<PaymentCreateResult> {
  const mode = detectPaymentMode()

  if (mode === 'demo') {
    return createDemoPayment(input)
  }

  return createKushkiPayment(input, mode as 'sandbox' | 'production')
}

// -----------------------------------------------------------
// Verificación de webhook
// -----------------------------------------------------------

/**
 * Verifica la firma del webhook de Kushki.
 *
 * Kushki envía el header `X-Kushki-Signature` con formato:
 *   "<timestamp>.<HMAC-SHA256(secret, timestamp + body)>"
 *
 * Verificación:
 *   1. Separar timestamp y signature (split por ".").
 *   2. Rechazar si timestamp > 5 min de antigüedad (replay attack protection).
 *   3. Calcular HMAC-SHA256(secret, timestamp + body).
 *   4. Comparar con timingSafeEqual (anti-timing-attack).
 *
 * Doc: https://docs.kushki.com/cl/notifications/overview
 *
 * Fix CRIT-9: agregar verificación de timestamp + replay protection.
 */
export function verifyKushkiWebhookSignature(
  body: string,
  signatureHeader: string | null,
  secret: string | undefined
): boolean {
  if (!secret) {
    // Si no hay secreto configurado, en modo demo aceptamos
    if (detectPaymentMode() === 'demo') return true
    return false
  }

  if (!signatureHeader) return false

  // Kushki signature format: "<timestamp>.<hmac>"
  const parts = signatureHeader.split('.')
  let timestamp: string
  let signature: string

  // Fix FLOW3-005: rechazar headers sin timestamp SIEMPRE (no fallback a "testing mode").
  // Solo el route handler decide si bypassa (dev local), no la función de verificación.
  if (parts.length === 2) {
    ;[timestamp, signature] = parts
  } else {
    // Sin timestamp: rechazar. El route handler ya controla el bypass de dev.
    console.warn('[kushki] Webhook rechazado: header sin formato timestamp.hmac')
    return false
  }

  // Fix FLOW3-006: detectar si el timestamp está en segundos o milisegundos.
  // Kushki/Stripe/PayPal suelen usar segundos (~1.7e9 para 2024), pero algunos usan ms (~1.7e12).
  // Heurística: si el número es < 1e10, está en segundos → multiplicar por 1000.
  const ts = Number(timestamp)
  if (!isNaN(ts)) {
    let tsMs = ts
    if (tsMs < 1e10) tsMs = tsMs * 1000  // segundos → ms
    const ageMs = Math.abs(Date.now() - tsMs)
    const MAX_AGE_MS = 5 * 60 * 1000 // 5 minutos
    if (ageMs > MAX_AGE_MS) {
      console.warn('[kushki] Webhook rechazado: timestamp demasiado antiguo', ageMs, 'ms (ts unit:', ts < 1e10 ? 'seconds' : 'ms', ')')
      return false
    }
  }

  // Fix FLOW3-007: comparación robusta que soporta hex y base64.
  // Kushki probablemente envía hex lowercase, pero ser defensivos.
  const dataToSign = `${timestamp}${body}`
  try {
    const expectedBuf = createHmac('sha256', secret).update(dataToSign).digest()  // Buffer binario (32 bytes)

    // Intentar hex primero (case-insensitive)
    let sigBuf: Buffer
    try {
      sigBuf = Buffer.from(signature, 'hex')
      // hex de 64 chars = 32 bytes. Si la longitud no es 32, no es hex válido.
      if (sigBuf.length !== 32) {
        // Probar base64
        sigBuf = Buffer.from(signature, 'base64')
      }
    } catch {
      sigBuf = Buffer.from(signature, 'base64')
    }

    if (expectedBuf.length !== sigBuf.length) return false
    return timingSafeEqual(expectedBuf, sigBuf)
  } catch {
    return false
  }
}

/**
 * Parsea el body del webhook de Kushki y lo normaliza a WebhookVerifyResult.
 *
 * Estructura típica del webhook de Kushki:
 *   {
 *     "country": "Ecuador",
 *     "ticketNumber": "...",
 *     "transactionStatus": "APPROVAL" | "DECLINED" | "PENDING",
 *     "amount": { "total": 18.00, "currency": "USD" },
 *     "metadata": { "order_id": "..." },
 *     ...
 *   }
 */
export function parseKushkiWebhook(body: any): WebhookVerifyResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, reason: 'Body inválido' }
  }

  const ticketNumber = body.ticketNumber ?? body.token
  const status = body.transactionStatus ?? body.status
  const orderId = body.metadata?.order_id ?? body.order_id

  if (!ticketNumber || !orderId) {
    return { valid: false, reason: 'Faltan ticketNumber u order_id' }
  }

  let normalizedStatus: WebhookVerifyResult['status']
  switch (String(status).toUpperCase()) {
    case 'APPROVAL':
    case 'APPROVED':
    case 'SUCCESS':
      normalizedStatus = 'captured'
      break
    case 'DECLINED':
    case 'FAILED':
    case 'REJECTED':
      normalizedStatus = 'failed'
      break
    case 'PENDING':
    case 'AUTHORIZED':
      normalizedStatus = 'authorized'
      break
    case 'REFUNDED':
    case 'REVERSED':
      normalizedStatus = 'refunded'
      break
    default:
      normalizedStatus = 'pending'
  }

  return {
    valid: true,
    order_id: String(orderId),
    provider_ref: String(ticketNumber),
    status: normalizedStatus,
    raw: body,
  }
}
