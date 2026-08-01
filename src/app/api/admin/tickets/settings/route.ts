/**
 * PATCH /api/admin/tickets/settings
 *
 * [F3.5] Permite al admin alternar `auto_expire_tickets_enabled` (settings),
 * que el cron /api/cron/expire-orders lee para pasar p_process_whatsapp a la
 * RPC expire_stale_orders_v2. Solo admins. Whitelist estricta de claves.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getSetting, updateSetting } from '@/lib/queries/settings'
import { SETTINGS_DEFAULTS } from '@/lib/constants'

export const runtime = 'nodejs'

/** Claves que el admin puede alternar desde esta vista (whitelist). */
const ALLOWED_KEYS = ['auto_expire_tickets_enabled'] as const

export async function PATCH(req: NextRequest) {
  await requireAdmin()

  let body: { auto_expire_tickets_enabled?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  if (typeof body.auto_expire_tickets_enabled !== 'boolean') {
    return NextResponse.json(
      { ok: false, error: 'auto_expire_tickets_enabled debe ser boolean' },
      { status: 400 }
    )
  }

  const result = await updateSetting(ALLOWED_KEYS[0], String(body.auto_expire_tickets_enabled))
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? 'Error actualizando configuración' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, auto_expire_tickets_enabled: body.auto_expire_tickets_enabled })
}

/**
 * GET — Retorna el estado actual del toggle (para inicializar la vista).
 * (El GET de /api/admin/tickets también lo incluye; este es un endpoint
 * explícito por si el admin recarga solo la tarjeta.)
 */
export async function GET() {
  await requireAdmin()
  const value = await getSetting(
    'auto_expire_tickets_enabled',
    String(SETTINGS_DEFAULTS.auto_expire_tickets_enabled)
  )
  return NextResponse.json({ ok: true, auto_expire_tickets_enabled: value !== 'false' })
}
