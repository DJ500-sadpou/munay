/**
 * Endpoint único para insertar el admin en DB de producción.
 * Protegido por CRON_SECRET. Después de usar, eliminar o deshabilitar.
 *
 * Uso: curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/admin/setup
 */
import { query } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')?.replace('Bearer ', '')
  const expected = process.env.CRON_SECRET
  if (!expected || authHeader !== expected) {
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

    return Response.json({
      ok: true,
      user_id: USER_ID,
      email: EMAIL,
      message: 'Admin created successfully. You can now access /admin.',
    })
  } catch (e: any) {
    console.error('[admin-setup] ❌ Error:', e.message)
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
