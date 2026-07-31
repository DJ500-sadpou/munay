import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isDbConfigured, query } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 401 })
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'DB no configurada' }, { status: 500 })
  }

  try {
    const { id, active } = await req.json()
    if (!id || typeof active !== 'boolean') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }

    await query(
      `UPDATE week_buy_campaigns SET active = $1 WHERE id = $2`,
      [active, id]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'Error al actualizar campaña' },
      { status: 500 }
    )
  }
}
