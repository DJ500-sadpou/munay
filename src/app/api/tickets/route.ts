/**
 * POST /api/tickets
 * Crea un ticket de soporte y abre WhatsApp con el mensaje.
 *
 * Body: { name, email, phone?, message }
 *
 * Seguridad:
 *   - Sin auth (público, cualquiera puede contactar)
 *   - Rate limiting básico: máximo 1 ticket por IP cada 60s
 *   - Validación de campos obligatorios
 */

import { NextRequest, NextResponse } from 'next/server'
import { query, isDbConfigured } from '@/lib/db/neon'
import { SITE } from '@/lib/constants'

export const runtime = 'nodejs'

// Rate limiter simple en memoria (se pierde al reiniciar, pero suficiente para prevenir abuso)
const ipTimestamps = new Map<string, number>()
const RATE_LIMIT_MS = 60_000 // 1 minuto

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const last = ipTimestamps.get(ip)
  if (last && now - last < RATE_LIMIT_MS) {
    return false // limitado
  }
  ipTimestamps.set(ip, now)
  // Limpiar entradas viejas cada 100 solicitudes
  if (ipTimestamps.size > 100) {
    const cutoff = now - RATE_LIMIT_MS
    for (const [key, ts] of ipTimestamps) {
      if (ts < cutoff) ipTimestamps.delete(key)
    }
  }
  return true
}

export async function POST(req: NextRequest) {
  // Rate limiting por IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
      { status: 429 }
    )
  }

  let body: {
    name: string
    email: string
    phone?: string
    message: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  // Validaciones
  const name = (body.name ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const phone = (body.phone ?? '').trim()
  const message = (body.message ?? '').trim()

  if (!name || name.length < 2) {
    return NextResponse.json({ ok: false, error: 'El nombre debe tener al menos 2 caracteres' }, { status: 400 })
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Email inválido' }, { status: 400 })
  }
  if (!message || message.length < 10) {
    return NextResponse.json({ ok: false, error: 'El mensaje debe tener al menos 10 caracteres' }, { status: 400 })
  }
  if (message.length > 2000) {
    return NextResponse.json({ ok: false, error: 'El mensaje no puede superar 2000 caracteres' }, { status: 400 })
  }

  // Insertar en DB si está configurada
  let ticketId: string | null = null
  if (isDbConfigured()) {
    try {
      const result = await query<any>(
        `INSERT INTO tickets (name, email, phone, message, status)
         VALUES ($1, $2, $3, $4, 'new')
         RETURNING id`,
        [name, email, phone || null, message]
      )
      ticketId = result[0]?.id ?? null
    } catch (err) {
      console.error('[tickets] DB insert error:', err)
      // Si falla DB, el ticket se pierde pero el usuario aún recibe el enlace de WhatsApp
    }
  }

  // Construir mensaje para WhatsApp con los datos del ticket
  const whatsappMessage = encodeURIComponent(
    `🆕 *Nuevo ticket de soporte - Munay*\n\n` +
    `👤 *Nombre:* ${name}\n` +
    `📧 *Email:* ${email}\n` +
    `${phone ? `📱 *Teléfono:* ${phone}\n` : ''}` +
    `📝 *Mensaje:*\n${message}`
  )

  const whatsappUrl = `https://wa.me/${SITE.whatsapp}?text=${whatsappMessage}`

  return NextResponse.json({
    ok: true,
    ticket_id: ticketId,
    whatsapp_url: whatsappUrl,
    message: 'Ticket creado. Serás redirigido a WhatsApp para continuar.',
  })
}
