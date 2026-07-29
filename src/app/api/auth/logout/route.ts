/**
 * POST /api/auth/logout
 * Cierra la sesión de Clerk y redirige.
 * Acepta ?next= para customizar el destino (default: /).
 * Verifica same-origin para evitar open redirect.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const next = url.searchParams.get('next') ?? '/'

  // Verificar same-origin (evitar open redirect)
  const target = new URL(next, req.url)
  if (target.origin !== new URL(req.url).origin) {
    return NextResponse.redirect(new URL('/', req.url), { status: 303 })
  }

  // Revocar sesión Clerk
  try {
    const { sessionId } = await auth()
    if (sessionId) {
      const client = await clerkClient()
      await client.sessions.revokeSession(sessionId)
    }
  } catch (err) {
    console.warn('[logout] error revocando sesión:', err instanceof Error ? err.message : err)
    // Continuamos: el redirect al menos saca al usuario de la UI
  }

  return NextResponse.redirect(target, { status: 303 })
}
