/**
 * @deprecated Re-exporta desde brevo.ts.
 * Importar directamente desde '@/lib/email/brevo' en código nuevo.
 */

export {
  type OrderConfirmationEmailData,
  type RefundEmailData,
  sendOrderConfirmationEmail,
  sendRefundEmail,
} from './brevo'
