/**
 * Lógica de creación de órdenes — Neon Postgres.
 *
 * Reescritura completa para Neon (sin Supabase) que además arregla
 * los hallazgos críticos de la auditoría:
 *
 *   - FLOW-001: validación de puntos SIEMPRE (guest no puede redimir).
 *   - FLOW-006: rollback de flash code si falla la creación de orden.
 *   - FLOW-007: atomicidad de redención de puntos con SELECT FOR UPDATE.
 *   - FLOW-012: si reserve_inventory falla, falla la orden.
 *   - CODE-003: select incluye points_redeemed para tx redeem.
 *   - CODE-007: raw del payment se mergea, no se sobrescribe.
 *
 * Toda la operación es transaccional (BEGIN/COMMIT/ROLLBACK).
 */

import { transaction, query, queryOne, isDbConfigured } from '@/lib/db/neon'
import { POINTS_RULES, LIMITS } from '@/lib/constants'
import { randomUUID } from 'crypto'
import { sendOrderConfirmationEmail, sendRefundEmail } from '@/lib/email/brevo'

export interface CreateOrderItemInput {
  product_id: string
  qty: number
}

export interface CreateOrderInput {
  items: CreateOrderItemInput[]
  customer_email: string
  customer_name?: string
  shipping_name?: string
  shipping_address?: string
  shipping_city?: string
  shipping_province?: string
  shipping_phone?: string
  shipping_cents?: number  // Fix FLOW3-009: costo de envío en centavos
  flash_code?: string | null
  points_to_redeem?: number
  user_id?: string | null
}

export interface CreateOrderResult {
  ok: boolean
  order_id?: string
  subtotal_cents?: number
  discount_cents?: number
  shipping_cents?: number  // Fix FLOW3-009: exponer en el resultado
  points_redeemed?: number
  total_cents?: number
  currency?: string
  error?: string
  error_code?:
    | 'no_db'
    | 'invalid_input'
    | 'product_not_found'
    | 'insufficient_stock'
    | 'flash_invalid'
    | 'points_invalid'
    | 'internal_error'
}

/**
 * Crea una orden en estado 'pending' de forma transaccional.
 *
 * Pasos:
 *   1. Validar items (qty entero > 0) y stock.
 *   2. Snapshot de precios desde DB.
 *   3. Si hay flash_code: llamar RPC consume_flash_code (atómico).
 *   4. Si hay points_to_redeem: validar saldo (requiere user_id + customer).
 *      Insertar tx redeem inmediatamente (atómico con SELECT FOR UPDATE).
 *   5. INSERT orders + order_items.
 *   6. reserve_inventory por item (falla la orden si falla).
 *
 * Si cualquier paso falla, se hace ROLLBACK completo y se libera
 * el flash code consumido (si aplica).
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  if (!isDbConfigured()) {
    return { ok: false, error: 'DB no configurada', error_code: 'no_db' }
  }

  // 1. Validaciones básicas
  if (!input.items || input.items.length === 0) {
    return { ok: false, error: 'Carrito vacío', error_code: 'invalid_input' }
  }
  if (!input.customer_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customer_email)) {
    return { ok: false, error: 'Email inválido', error_code: 'invalid_input' }
  }
  // Validar qty enteros positivos (CODE-030)
  for (const item of input.items) {
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      return { ok: false, error: 'Cantidad inválida', error_code: 'invalid_input' }
    }
  }

  // 2a. Validación de shipping_cents (Fix auditoría: cota máxima)
  if (input.shipping_cents != null && input.shipping_cents < 0) {
    return { ok: false, error: 'Costo de envío inválido (negativo)', error_code: 'invalid_input' }
  }
  if (input.shipping_cents != null && input.shipping_cents > LIMITS.maxShippingCents) {
    return {
      ok: false,
      error: `Costo de envío excede el máximo de $${(LIMITS.maxShippingCents / 100).toFixed(2)}`,
      error_code: 'invalid_input',
    }
  }

  // 2b. Validación de puntos: guests NO pueden redimir (FLOW-001)
  if (input.points_to_redeem && input.points_to_redeem > 0) {
    if (!input.user_id) {
      return {
        ok: false,
        error: 'Inicia sesión para redimir puntos',
        error_code: 'points_invalid',
      }
    }
    if (input.points_to_redeem % POINTS_RULES.MIN_POINTS_TO_REDEEM !== 0) {
      return {
        ok: false,
        error: `Los puntos deben ser múltiplos de ${POINTS_RULES.MIN_POINTS_TO_REDEEM}`,
        error_code: 'points_invalid',
      }
    }
  }

  // 3. Traer productos + stock (snapshot)
  const productIds = input.items.map((i) => i.product_id)
  const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',')
  const productsRows = await query<any>(`
    SELECT id, slug, title, price_cents, currency, active,
      COALESCE((SELECT stock FROM inventory WHERE product_id = p.id), 0) AS stock,
      COALESCE((SELECT reserved FROM inventory WHERE product_id = p.id), 0) AS reserved
    FROM products p
    WHERE id IN (${placeholders})
  `, productIds)

  const productsMap = new Map(productsRows.map((p) => [p.id, p]))

  // 4. Validar disponibilidad + calcular subtotal
  const orderItems: Array<{ product_id: string; qty: number; unit_price_cents: number }> = []
  let subtotalCents = 0
  const currency = 'USD'

  for (const item of input.items) {
    const product = productsMap.get(item.product_id)
    if (!product || !product.active) {
      return {
        ok: false,
        error: `Producto no encontrado o inactivo: ${item.product_id}`,
        error_code: 'product_not_found',
      }
    }
    const available = Number(product.stock) - Number(product.reserved)
    if (item.qty > available) {
      return {
        ok: false,
        error: `Stock insuficiente para "${product.title}". Disponible: ${available}`,
        error_code: 'insufficient_stock',
      }
    }
    orderItems.push({
      product_id: item.product_id,
      qty: item.qty,
      unit_price_cents: Number(product.price_cents),
    })
    subtotalCents += Number(product.price_cents) * item.qty
  }

  // 5. Ejecutar transacción atómica
  try {
    const result = await transaction(async (tx) => {
      let discountCents = 0
      let flashCodeApplied: string | null = null
      let pointsRedeemed = 0

      // 5a. Consumir flash code (RPC atómica con FOR UPDATE)
      if (input.flash_code) {
        const flashRows = await tx`SELECT * FROM consume_flash_code(${input.flash_code})`
        const fr = flashRows[0] as any
        if (!fr?.ok) {
          const reason = fr?.reason ?? 'unknown'
          const messages: Record<string, string> = {
            not_found: 'Código flash no encontrado',
            inactive: 'Código flash inactivo',
            not_started: 'Código flash aún no vigente',
            expired: 'Código flash expirado',
            exhausted: 'Código flash agotado',
          }
          throw { type: 'flash_invalid', message: messages[reason] ?? 'Código inválido' }
        }
        flashCodeApplied = fr.code
        if (fr.type === 'discount') {
          if (fr.discount_percent != null) {
            discountCents = Math.round(subtotalCents * (fr.discount_percent / 100))
          } else if (fr.discount_cents != null) {
            discountCents = Math.min(subtotalCents, Number(fr.discount_cents))
          }
        }
      }

      // 5b. Generar order_id antes (necesario para redeem_points)
      const orderId = randomUUID()

      // 5c. Redimir puntos (atómico con FOR UPDATE) — solo si hay user_id
      // Fix CRIT-3: redeem_points ahora INSERTA la tx redeem atómicamente.
      // Si la tx redeem falla (saldo insuficiente, customer no encontrado),
      // la transacción entera falla y se hace ROLLBACK (no se crea la orden).
      if (input.points_to_redeem && input.points_to_redeem > 0 && input.user_id) {
        const redeemRows = await tx`SELECT * FROM redeem_points(${input.user_id}, ${input.points_to_redeem}, ${orderId})`
        const rr = redeemRows[0] as any
        if (!rr?.ok) {
          const reason = rr?.reason ?? 'unknown'
          const messages: Record<string, string> = {
            no_customer: 'No tienes cuenta de cliente. Inicia sesión y haz una compra primero.',
            insufficient_balance: `Saldo insuficiente. Tienes ${rr?.balance ?? 0} puntos.`,
            invalid_amount: 'Cantidad de puntos inválida',
          }
          throw { type: 'points_invalid', message: messages[reason] ?? 'Redención inválida' }
        }
        pointsRedeemed = input.points_to_redeem
        discountCents += Math.floor(pointsRedeemed / POINTS_RULES.POINTS_PER_DISCOUNT_DOLLAR) * 100
      }

      discountCents = Math.min(discountCents, subtotalCents)
      // Fix FLOW3-009: incluir shipping_cents en el total.
      // En la DB shipping_cents default 0, pero respetamos el valor enviado.
      const shippingCents = input.shipping_cents ?? 0
      const totalCents = subtotalCents - discountCents + shippingCents

      // 5d. INSERT orders (con order_id generado en TS)
      await tx`
        INSERT INTO orders (
          id, user_id, customer_email, status, subtotal_cents, discount_cents,
          shipping_cents, points_redeemed, total_cents,
          shipping_name, shipping_address, shipping_city, shipping_province, shipping_phone
        ) VALUES (
          ${orderId}, ${input.user_id ?? null}, ${input.customer_email}, 'pending',
          ${subtotalCents}, ${discountCents}, ${shippingCents}, ${pointsRedeemed}, ${totalCents},
          ${input.shipping_name ?? null}, ${input.shipping_address ?? null},
          ${input.shipping_city ?? null}, ${input.shipping_province ?? null},
          ${input.shipping_phone ?? null}
        )
      `

      // 5e. INSERT order_items (batch)
      for (const item of orderItems) {
        await tx`
          INSERT INTO order_items (order_id, product_id, qty, unit_price_cents)
          VALUES (${orderId}, ${item.product_id}, ${item.qty}, ${item.unit_price_cents})
        `
      }

      // 5f. reserve_inventory por item (falla si stock insuficiente)
      for (const item of orderItems) {
        const reserveRows = await tx`SELECT * FROM reserve_inventory(${item.product_id}, ${item.qty})`
        const rr = reserveRows[0] as any
        if (!rr?.ok) {
          throw {
            type: 'insufficient_stock',
            message: `Stock insuficiente para producto ${item.product_id}`,
          }
        }
      }

      return {
        orderId,
        subtotalCents,
        discountCents,
        shippingCents,
        pointsRedeemed,
        totalCents,
        flashCodeApplied,
      }
    })

    return {
      ok: true,
      order_id: result.orderId,
      subtotal_cents: result.subtotalCents,
      discount_cents: result.discountCents,
      shipping_cents: result.shippingCents,
      points_redeemed: result.pointsRedeemed,
      total_cents: result.totalCents,
      currency,
    }
  } catch (err: any) {
    // Si falla por flash_invalid o points_invalid, el rollback libera el flash code
    // automáticamente (la transacción se aborta antes del commit).
    if (err?.type === 'flash_invalid') {
      return { ok: false, error: err.message, error_code: 'flash_invalid' }
    }
    if (err?.type === 'points_invalid') {
      return { ok: false, error: err.message, error_code: 'points_invalid' }
    }
    if (err?.type === 'insufficient_stock') {
      return { ok: false, error: err.message, error_code: 'insufficient_stock' }
    }
    console.error('[createOrder] error:', err)
    return { ok: false, error: 'Error interno creando orden', error_code: 'internal_error' }
  }
}

/**
 * Marca una orden como 'paid' de forma transaccional.
 * Incluye verificación de monto (FLOW-011) e idempotencia.
 *
 * Pasos:
 *   1. SELECT FOR UPDATE la orden (lock).
 *   2. Si ya está paid → return ok (idempotente).
 *   3. Si está cancelled/refunded → error.
 *   4. UPDATE orders SET status='paid'.
 *   5. UPDATE payments SET status='captured', provider_ref.
 *   6. commit_inventory por item.
 *   7. award_points (RPC idempotente).
 *   8. Si points_redeemed > 0: ya se insertó en createOrder (no duplicar).
 */
export async function markOrderPaid(
  orderId: string,
  providerRef: string,
  paidCents?: number
): Promise<{ ok: boolean; error?: string; pointsWarning?: string }> {
  if (!isDbConfigured()) return { ok: false, error: 'DB no configurada' }

  try {
    const result = await transaction(async (tx) => {
      // 1. Lock + leer orden
      const orderRows = await tx`SELECT * FROM orders WHERE id = ${orderId} FOR UPDATE`
      const order = orderRows[0] as any
      if (!order) throw { type: 'not_found' }

      // 2. Idempotencia
      if (order.status === 'paid') return { ok: true, alreadyPaid: true }

      // 3. Validar estado
      if (order.status === 'cancelled' || order.status === 'refunded') {
        throw { type: 'invalid_state', current: order.status }
      }

      // 4. Verificar monto (FLOW-011)
      if (paidCents != null && paidCents !== Number(order.total_cents)) {
        throw {
          type: 'amount_mismatch',
          expected: Number(order.total_cents),
          received: paidCents,
        }
      }

      // 5. UPDATE orders
      await tx`UPDATE orders SET status = 'paid', updated_at = now() WHERE id = ${orderId}`

      // 6. UPDATE payments
      await tx`
        UPDATE payments
        SET status = 'captured', provider_ref = ${providerRef}
        WHERE order_id = ${orderId}
      `

      // 7. commit_inventory
      const items = await tx`SELECT product_id, qty FROM order_items WHERE order_id = ${orderId}`
      for (const item of items) {
        await tx`SELECT * FROM commit_inventory(${item.product_id}, ${item.qty})`
      }

      // 8. award_points (idempotente via RPC)
      let pointsAwarded = false
      let pointsWarning: string | undefined
      const awardResult = await tx`SELECT * FROM award_points(${orderId})`
      const ar = awardResult[0] as any
      if (ar?.ok) {
        pointsAwarded = true
      } else if (ar?.reason === 'already_awarded') {
        pointsAwarded = true
      } else {
        // Fix FLOW3-010: award_points ya no falla silenciosamente.
        // Retornamos warning para que el caller pueda registrarlo.
        pointsWarning = ar?.reason ?? 'error_desconocido'
        console.warn('[markOrderPaid] award_points falló:', pointsWarning)
      }

      // 9. Enviar email de confirmación (fire-and-forget, no bloquea)
      //    Necesitamos datos completos de la orden para el email.
      //    Los obtenemos fuera de la transacción para no mantener el lock.
      return { ok: true, pointsAwarded, pointsWarning, orderData: { customerEmail: order.customer_email } }
    })

    // Enviar email de confirmación después de la transacción (fire-and-forget)
    if (result.ok) {
      try {
        // Obtener datos completos de la orden para el email
        const orderData = await queryOne<any>(`
          SELECT o.customer_email, o.customer_name, o.subtotal_cents, o.discount_cents,
                 o.points_redeemed, o.total_cents, o.shipping_cents,
                 o.shipping_name, o.shipping_address, o.shipping_city,
                 o.shipping_province, o.shipping_phone
          FROM orders o WHERE o.id = $1
        `, [orderId])

        const items = await query<any>(
          `SELECT p.title, oi.qty, oi.unit_price_cents
           FROM order_items oi
           JOIN products p ON p.id = oi.product_id
           WHERE oi.order_id = $1`,
          [orderId]
        )

        if (orderData) {
          sendOrderConfirmationEmail({
            orderId,
            customerEmail: orderData.customer_email,
            customerName: orderData.customer_name,
            items: items.map((i: any) => ({
              title: i.title,
              qty: i.qty,
              unit_price_cents: i.unit_price_cents,
            })),
            subtotal_cents: Number(orderData.subtotal_cents),
            discount_cents: Number(orderData.discount_cents),
            points_redeemed: Number(orderData.points_redeemed),
            total_cents: Number(orderData.total_cents),
            points_earned: Math.floor(Number(orderData.total_cents) / 100),
            shipping: {
              name: orderData.shipping_name,
              address: orderData.shipping_address,
              city: orderData.shipping_city,
              province: orderData.shipping_province,
              phone: orderData.shipping_phone,
            },
          }).catch((err) => {
            console.warn('[markOrderPaid] Email confirmación falló (no bloqueante):', err?.message)
          })
        }
      } catch (emailErr: any) {
        console.warn('[markOrderPaid] Error obteniendo datos para email:', emailErr?.message)
      }
    }

    return result
  } catch (err: any) {
    if (err?.type === 'not_found') return { ok: false, error: 'Orden no encontrada' }
    if (err?.type === 'invalid_state') return { ok: false, error: `Orden en estado ${err.current}` }
    if (err?.type === 'amount_mismatch') {
      return { ok: false, error: `Monto ${err.received} ≠ total ${err.expected}` }
    }
    console.error('[markOrderPaid] error:', err)
    return { ok: false, error: 'Error interno' }
  }
}

/**
 * Marca una orden como 'cancelled' de forma atómica (TOCTOU-safe).
 * Libera inventario reservado.
 */
export async function markOrderCancelled(orderId: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  if (!isDbConfigured()) return { ok: false, error: 'DB no configurada' }

  try {
    const result = await transaction(async (tx) => {
      // UPDATE condicional (atómico, evita TOCTOU)
      const rows = await tx`
        UPDATE orders SET status = 'cancelled', updated_at = now()
        WHERE id = ${orderId} AND status = 'pending'
        RETURNING id, points_redeemed, customer_email
      `
      if (rows.length === 0) {
        const check = await tx`SELECT status FROM orders WHERE id = ${orderId}`
        if (check.length === 0) throw { type: 'not_found' }
        throw { type: 'invalid_state', current: check[0].status }
      }

      const cancelledOrder = rows[0] as any

      // Liberar inventario
      const items = await tx`SELECT product_id, qty FROM order_items WHERE order_id = ${orderId}`
      for (const item of items) {
        await tx`SELECT * FROM release_inventory(${item.product_id}, ${item.qty})`
      }

      // Marcar payments como failed
      await tx`UPDATE payments SET status = 'failed' WHERE order_id = ${orderId} AND status = 'pending'`

      // Fix FLOW3-001: devolver puntos redimidos si la orden tenía redención.
      if (Number(cancelledOrder.points_redeemed) > 0) {
        // Buscar customer por email para insertar tx adjust positiva.
        const customer = await tx`SELECT id FROM customers WHERE email = ${cancelledOrder.customer_email} LIMIT 1`
        if (customer.length > 0) {
          await tx`
            INSERT INTO point_transactions (customer_id, order_id, type, points, note)
            VALUES (${customer[0].id}, ${orderId}, 'adjust', ${Number(cancelledOrder.points_redeemed)}, 'Devolución: orden cancelada/expirada')
          `
        }
      }

      return { ok: true }
    })
    console.log(`[markOrderCancelled] Orden ${orderId} cancelada. Razón: ${reason ?? 'no especificada'}`)
    return result
  } catch (err: any) {
    if (err?.type === 'not_found') return { ok: false, error: 'Orden no encontrada' }
    if (err?.type === 'invalid_state') return { ok: false, error: `Orden en estado ${err.current}` }
    console.error('[markOrderCancelled] error:', err)
    return { ok: false, error: 'Error interno' }
  }
}
