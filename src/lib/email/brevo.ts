/**
 * Emails transaccionales — Brevo (antes Sendinblue).
 *
 * Reemplaza a src/lib/email/index.ts (Resend).
 *
 * Usa nodemailer con nodemailer-brevo-transport.
 * Plan free: 300 emails/día, 9,000/mes, sin tarjeta.
 * Permite enviar desde dominio compartido (no requiere dominio propio).
 *
 * Variables de entorno:
 *   BREVO_API_KEY=...         (obtenido en brevo.com → API Keys)
 *   FROM_EMAIL="Munay <noreply@brevo.com>"  (o tu dominio verificado)
 */

import nodemailer from 'nodemailer'
import brevoTransport from 'nodemailer-brevo-transport'

export interface OrderConfirmationEmailData {
  orderId: string
  customerEmail: string
  customerName?: string
  items: Array<{
    title: string
    qty: number
    unit_price_cents: number
  }>
  subtotal_cents: number
  discount_cents: number
  points_redeemed: number
  total_cents: number
  points_earned: number
  shipping: {
    name?: string
    address?: string
    city?: string
    province?: string
    phone?: string
  }
  // Cupón de fidelidad post-compra
  loyalty_coupon?: {
    code: string
    discount_percent: number
  }
}

export interface RefundEmailData {
  orderId: string
  customerEmail: string
  customerName?: string
  total_cents: number
  points_reverted: number
  points_returned: number
  reason: string
}

const FROM_EMAIL = process.env.FROM_EMAIL ?? 'Munay <noreply@brevo.com>'

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter

  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    throw new Error('Falta BREVO_API_KEY en variables de entorno.')
  }

  transporter = nodemailer.createTransport(
    new (brevoTransport as any)({ apiKey })
  )
  return transporter
}

/**
 * Envía un email via Brevo.
 * Si no hay BREVO_API_KEY, loguea a consola (modo dev).
 */
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    console.log(`\n📧 [EMAIL-DEV] To: ${to}\n   Subject: ${subject}\n   Body: ${text ?? '(html only)'}\n`)
    return { ok: true, error: 'dev_mode_logged' }
  }

  try {
    const transport = getTransporter()
    await transport.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text: text ?? undefined,
    })
    return { ok: true }
  } catch (err: any) {
    console.error('[email] Brevo send error:', err?.message)
    return { ok: false, error: err?.message }
  }
}

/**
 * Email de confirmación de orden (tras pago confirmado).
 */
export async function sendOrderConfirmationEmail(data: OrderConfirmationEmailData): Promise<void> {
  const itemsHtml = data.items.map((it) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(it.title)} × ${it.qty}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">$${(it.unit_price_cents * it.qty / 100).toFixed(2)}</td>
    </tr>
  `).join('')

  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#faf7f2;padding:32px;color:#2a1f15;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="font-size:28px;color:#7a3a1f;margin:0;">Munay</h1>
        <p style="font-size:13px;color:#7a6a5a;margin:4px 0 0;">Ropa nueva y de segunda · Ibarra, Ecuador</p>
      </div>
      <h2 style="font-size:20px;color:#2a1f15;">¡Gracias por tu compra, ${escapeHtml(data.customerName ?? '')}!</h2>
      <p style="color:#5a4a3a;">Tu pago fue confirmado. Aquí están los detalles:</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <thead>
          <tr style="border-bottom:2px solid #7a3a1f;">
            <th style="text-align:left;padding:8px 0;color:#7a3a1f;">Producto</th>
            <th style="text-align:right;padding:8px 0;color:#7a3a1f;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <table style="width:100%;font-size:14px;margin-top:16px;">
        <tr><td style="padding:4px 0;color:#5a4a3a;">Subtotal:</td><td style="text-align:right;">$${(data.subtotal_cents / 100).toFixed(2)}</td></tr>
        ${data.discount_cents > 0 ? `<tr><td style="padding:4px 0;color:#7a3a1f;">Descuento:</td><td style="text-align:right;color:#7a3a1f;">−$${(data.discount_cents / 100).toFixed(2)}</td></tr>` : ''}
        <tr><td style="padding:8px 0;font-weight:bold;border-top:1px solid #7a3a1f;">Total:</td><td style="text-align:right;font-weight:bold;border-top:1px solid #7a3a1f;">$${(data.total_cents / 100).toFixed(2)}</td></tr>
      </table>

      ${data.points_earned > 0 ? `<p style="background:#fdf6e8;padding:12px;border-radius:8px;margin-top:16px;color:#7a3a1f;">✨ Ganaste <strong>${data.points_earned} puntos</strong> con esta compra.</p>` : ''}

      ${data.loyalty_coupon ? `
      <div style="background:linear-gradient(135deg,#f0e6d3,#e8dcc8);border:1px solid #7a3a1f;border-radius:12px;padding:20px;margin-top:20px;text-align:center;">
        <p style="font-size:14px;color:#7a3a1f;margin:0;">🎁 ¡Gracias por tu compra!</p>
        <p style="font-size:24px;font-weight:bold;color:#2a1f15;margin:8px 0;">${data.loyalty_coupon.discount_percent}% de descuento</p>
        <p style="font-size:13px;color:#5a4a3a;margin:4px 0;">en tu próxima compra</p>
        <div style="background:#fff;border-radius:8px;padding:12px;margin:12px 0;font-family:monospace;font-size:18px;letter-spacing:3px;color:#2a1f15;">${data.loyalty_coupon.code}</div>
        <p style="font-size:11px;color:#9a8a7a;margin:4px 0;">Válido por 7 días · 1 uso · Descuento configurable por el admin</p>
      </div>` : ''}

      ${data.shipping.address ? `
      <h3 style="font-size:15px;color:#2a1f15;margin-top:24px;">Envío</h3>
      <p style="font-size:13px;color:#5a4a3a;line-height:1.5;">
        ${escapeHtml(data.shipping.name ?? '')}<br/>
        ${escapeHtml(data.shipping.address)}<br/>
        ${escapeHtml(data.shipping.city ?? '')}, ${escapeHtml(data.shipping.province ?? '')}<br/>
        ${escapeHtml(data.shipping.phone ?? '')}
      </p>` : ''}

      <p style="font-size:12px;color:#9a8a7a;margin-top:32px;text-align:center;">
        Orden #${data.orderId.slice(0, 8)} · Este email fue enviado automáticamente.
      </p>
    </div>
  `

  const text = `Munay - Confirmación de orden #${data.orderId.slice(0, 8)}

Gracias por tu compra${data.customerName ? `, ${data.customerName}` : ''}!

Items:
${data.items.map((it) => `- ${it.title} × ${it.qty}: $${(it.unit_price_cents * it.qty / 100).toFixed(2)}`).join('\n')}

Subtotal: $${(data.subtotal_cents / 100).toFixed(2)}
${data.discount_cents > 0 ? `Descuento: −$${(data.discount_cents / 100).toFixed(2)}\n` : ''}Total: $${(data.total_cents / 100).toFixed(2)}

${data.points_earned > 0 ? `Ganaste ${data.points_earned} puntos con esta compra.\n` : ''}

${data.shipping.address ? `Envío:
${data.shipping.name ?? ''}
${data.shipping.address}
${data.shipping.city ?? ''}, ${data.shipping.province ?? ''}
${data.shipping.phone ?? ''}` : ''}

Orden completa: ${data.orderId}
`

  await sendEmail(
    data.customerEmail,
    `Confirmación de tu compra en Munay · #${data.orderId.slice(0, 8)}`,
    html,
    text
  )
}

/**
 * Email de notificación de reembolso.
 */
export async function sendRefundEmail(data: RefundEmailData): Promise<void> {
  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#faf7f2;padding:32px;color:#2a1f15;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="font-size:28px;color:#7a3a1f;margin:0;">Munay</h1>
      </div>
      <h2 style="font-size:20px;">Reembolso procesado</h2>
      <p>Tu orden <strong>#${data.orderId.slice(0, 8)}</strong> fue reembolsada.</p>
      <p><strong>Monto:</strong> $${(data.total_cents / 100).toFixed(2)}</p>
      ${data.points_reverted > 0 ? `<p>Se revirtieron <strong>${data.points_reverted} puntos</strong> que habías ganado.</p>` : ''}
      ${data.points_returned > 0 ? `<p>Se devolvieron <strong>${data.points_returned} puntos</strong> que habías redimido.</p>` : ''}
      <p style="color:#5a4a3a;font-size:13px;margin-top:24px;">Razón: ${escapeHtml(data.reason)}</p>
      <p style="font-size:12px;color:#9a8a7a;margin-top:24px;">Si tienes preguntas, responde a este email.</p>
    </div>
  `

  await sendEmail(
    data.customerEmail,
    `Reembolso procesado · Orden #${data.orderId.slice(0, 8)}`,
    html,
    `Reembolso procesado para orden #${data.orderId.slice(0, 8)}.\nMonto: $${(data.total_cents / 100).toFixed(2)}\nRazón: ${data.reason}`
  )
}

// Helper anti-XSS en emails
function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
