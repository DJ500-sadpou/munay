/**
 * Cloudflare Turnstile — verificación server-side.
 *
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * El cliente obtiene un token con el widget de Turnstile (usando NEXT_PUBLIC_TURNSTILE_SITE_KEY).
 * El servidor verifica ese token llamando a https://challenges.cloudflare.com/turnstile/v0/siteverify
 * con TURNSTILE_SECRET_KEY.
 *
 * Si no hay secret configurado, retorna true (modo dev sin Turnstile).
 */

export interface TurnstileVerifyResult {
  success: boolean
  error?: string
  action?: string
  cdata?: string
  hostname?: string
  challenge_ts?: string
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteip?: string
): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY

  // Si no hay secret configurado, permitir (modo dev)
  if (!secret) {
    return { success: true, error: 'turnstile_not_configured' }
  }

  if (!token) {
    return { success: false, error: 'missing_token' }
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
    })
    if (remoteip) body.append('remoteip', remoteip)

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    })

    const data = await res.json()

    return {
      success: !!data.success,
      error: data['error-codes']?.join(', '),
      action: data.action,
      cdata: data.cdata,
      hostname: data.hostname,
      challenge_ts: data.challenge_ts,
    }
  } catch (err: any) {
    console.error('[turnstile] verify error:', err?.message)
    return { success: false, error: 'verification_failed' }
  }
}

/**
 * Helper para usar en route handlers.
 * Retorna null si la verificación pasa, o una Response de error si falla.
 */
export async function requireTurnstile(
  token: string | null | undefined,
  remoteip?: string
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const result = await verifyTurnstileToken(token, remoteip)
  if (!result.success && result.error !== 'turnstile_not_configured') {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ ok: false, error: 'Verificación anti-bot falló', detail: result.error }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      ),
    }
  }
  return { ok: true }
}
