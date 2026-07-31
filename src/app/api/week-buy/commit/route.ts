import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { isDbConfigured } from '@/lib/db/neon'
import { commitToWeekBuy } from '@/lib/queries/week-buy'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Debes iniciar sesión' }, { status: 401 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ ok: false, error: 'DB no configurada' }, { status: 500 })
    }

    const { campaignId, email } = await req.json()

    if (!campaignId) {
      return NextResponse.json({ ok: false, error: 'Falta campaignId' }, { status: 400 })
    }

    const userEmail = email || user.emailAddresses?.[0]?.emailAddress
    if (!userEmail) {
      return NextResponse.json({ ok: false, error: 'Email requerido' }, { status: 400 })
    }

    const result = await commitToWeekBuy(campaignId, user.id, userEmail)

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/week-buy/commit] Error:', err)
    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
