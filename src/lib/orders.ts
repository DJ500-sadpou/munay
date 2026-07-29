/**
 * @deprecated Re-exporta desde orders-neon.ts.
 * Importar directamente desde '@/lib/orders-neon' en código nuevo.
 */

export {
  type CreateOrderItemInput,
  type CreateOrderInput,
  type CreateOrderResult,
  createOrder,
  markOrderPaid,
  markOrderCancelled,
} from './orders-neon'
