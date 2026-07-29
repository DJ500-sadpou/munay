/**
 * POST /api/flash/validate
 * Valida un código flash sin consumirlo.
 *
 * Protegido por Cloudflare Turnstile en producción.
 */

import { NextRequest, NextResponse } from 'next/server'
import { queryOne, isDbConfigured } from '@/lib/db/neon'
import { requireTurnstile } from '@/lib/auth/turnstile'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { valid: false, reason: 'Base de datos no configurada. Verifica DATABASE_URL en .env.local' },
      { status: 503 }
    )
  }

  let body: { code?: string; turnstile_token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ valid: false, reason: 'JSON inválido' }, { status: 400 })
  }

  // Verificar Turnstile (en dev sin TURNSTILE_SECRET_KEY pasa automáticamente)
  const turnstileCheck = await requireTurnstile(
    body.turnstile_token,
    req.headers.get('x-forwarded-for') ?? undefined
  )
  if (!turnstileCheck.ok) {
    return new NextResponse(turnstileCheck.response!.body, {
      status: turnstileCheck.response!.status,
      headers: turnstileCheck.response!.headers,
    })
  }

  const code = (body.code ?? '').trim().toUpperCase()
  if (code.length < 4 || code.length > 32) {
    return NextResponse.json(
      { valid: false, reason: 'El código debe tener entre 4 y 32 caracteres.' },
      { status: 400 }
    )
  }

  // Fix FLOW3-002: query directa Neon (no stub).
  const data = await queryOne<any>(`
    SELECT code, type, discount_percent, discount_cents, starts_at, ends_at, max_uses, uses_count, active
    FROM flash_codes WHERE code = $1
  `, [code])

  if (!data) {
    // Fix FLOW-021: mensaje genérico para evitar enumeración.
    return NextResponse.json(
      { valid: false, reason: 'Código no válido.' },
      { status: 404 }
    )
  }

  if (!data.active) {
    return NextResponse.json({ valid: false, reason: 'Código no válido.' }, { status: 410 })
  }

  const now = new Date()
  if (new Date(data.starts_at) > now) {
    return NextResponse.json({ valid: false, reason: 'Código no válido.' }, { status: 410 })
  }
  if (new Date(data.ends_at) < now) {
    return NextResponse.json({ valid: false, reason: 'Código no válido.' }, { status: 410 })
  }
  if (data.max_uses !== null && Number(data.uses_count) >= Number(data.max_uses)) {
    return NextResponse.json({ valid: false, reason: 'Código no válido.' }, { status: 410 })
  }

  return NextResponse.json({
    valid: true,
    code: data.code,
    type: data.type,
    discount_percent: data.discount_percent !== null ? Number(data.discount_percent) : null,
    discount_cents: data.discount_cents !== null ? Number(data.discount_cents) : null,
    ends_at: data.ends_at,
    remaining_uses: data.max_uses !== null ? Math.max(0, Number(data.max_uses) - Number(data.uses_count)) : null,
  })
}
