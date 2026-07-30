/**
 * Endpoint único para insertar el admin en DB de producción.
 * Protegido por CRON_SECRET. Después de usar, eliminar o deshabilitar.
 *
 * Uso: curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/admin/setup
 */
import { query } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // One-time setup: protegido por CRON_SECRET o por cabecera especial
  const authHeader = request.headers.get('authorization')?.replace('Bearer ', '')
  const expected = process.env.CRON_SECRET
  const isAuthorized = expected && authHeader === expected
  // Fallback para one-time setup: permitir si se envía X-Setup-Key con un valor fijo
  const setupKey = request.headers.get('x-setup-key')
  const HAS_SETUP_KEY = 'munay-admin-setup-2026'

  if (!isAuthorized && setupKey !== HAS_SETUP_KEY) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const USER_ID = 'user_3HCP…WxaITwRGT'
  const EMAIL = 'untunadylan55@gmail.com'

  try {
    await query(
      `INSERT INTO public.users (id, email) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
      [USER_ID, EMAIL]
    )
    console.log('[admin-setup] ✅ User inserted:', USER_ID)

    await query(
      `INSERT INTO public.admins (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [USER_ID]
    )
    console.log('[admin-setup] ✅ Admin registered')

    // Verificar
    const check = await query(`SELECT user_id FROM admins WHERE user_id = $1`, [USER_ID])
    const verified = check.length > 0

    return Response.json({
      ok: true,
      verified,
      user_id: USER_ID,
      email: EMAIL,
      message: verified
        ? '✅ Admin creado exitosamente. Accede a /admin.'
        : '⚠️ Admin insertado pero no se pudo verificar.',
    })
  } catch (e: any) {
    console.error('[admin-setup] ❌ Error:', e.message)
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
