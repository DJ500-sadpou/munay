/**
 * /api/admin/coupons
 *
 * GET  — Lista TODOS los cupones (admin)
 * POST — Crea un cupón
 *
 * Protegido por auth() + checkAdminRow (patrón del proyecto, JSON explícito).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isDbConfigured } from '@/lib/db/neon'
import { checkAdminRow } from '@/lib/auth/admin-checks'
import { getAllCoupons, createCoupon } from '@/lib/queries/coupons'

export const runtime = 'nodejs'

async function checkAdmin() {
  if (!isDbConfigured()) {
    return { ok: false, response: NextResponse.json({ error: 'DB no configurada' }, { status: 503 }) }
  }
  const { userId } = await auth()
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }
  const isAdmin = await checkAdminRow(userId)
  if (!isAdmin) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  return { ok: true }
}

export async function GET() {
  const guard = await checkAdmin()
  if (!guard.ok) return guard.response!

  const coupons = await getAllCoupons()
  return NextResponse.json({ ok: true, data: coupons })
}

export async function POST(req: NextRequest) {
  const guard = await checkAdmin()
  if (!guard.ok) return guard.response!

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Validaciones
  const codigo = (body.codigo ?? '').trim().toUpperCase()
  if (!codigo || codigo.length < 4 || codigo.length > 32) {
    return NextResponse.json({ error: 'El código debe tener 4-32 caracteres' }, { status: 400 })
  }
  if (!/^[A-Z0-9]+$/.test(codigo)) {
    return NextResponse.json({ error: 'Solo letras mayúsculas y números' }, { status: 400 })
  }
  if (!body.tipo || !['general', 'primera_compra'].includes(body.tipo)) {
    return NextResponse.json({ error: 'Tipo inválido (general o primera_compra)' }, { status: 400 })
  }
  const pct = Number(body.porcentaje_descuento)
  if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
    return NextResponse.json({ error: 'El porcentaje debe estar entre 1 y 100' }, { status: 400 })
  }
  const minUsd = Number(body.monto_minimo_compra ?? 20)
  if (!Number.isFinite(minUsd) || minUsd < 0) {
    return NextResponse.json({ error: 'Monto mínimo inválido' }, { status: 400 })
  }
  const montoMinimoCents = Math.round(minUsd * 100)
  const fechaInicio = new Date(body.fecha_inicio)
  const fechaFin = new Date(body.fecha_fin)
  if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
    return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 })
  }
  if (fechaFin <= fechaInicio) {
    return NextResponse.json({ error: 'La fecha de fin debe ser posterior al inicio' }, { status: 400 })
  }
  let usosMaximos: number | null = null
  if (body.usos_maximos != null && body.usos_maximos !== '') {
    usosMaximos = Number(body.usos_maximos)
    if (!Number.isFinite(usosMaximos) || usosMaximos < 1) {
      return NextResponse.json({ error: 'Usos máximos inválido' }, { status: 400 })
    }
  }

  const result = await createCoupon({
    codigo,
    tipo: body.tipo,
    porcentaje_descuento: Math.round(pct),
    monto_minimo_compra: montoMinimoCents,
    fecha_inicio: fechaInicio.toISOString(),
    fecha_fin: fechaFin.toISOString(),
    activo: body.activo !== false,
    usos_maximos: usosMaximos,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Error al crear el cupón' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, data: result.coupon }, { status: 201 })
}
