/**
 * Crea el usuario admin en Neon DB.
 * Uso: node scripts/create-admin.mjs
 */
import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env.local') })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ Falta DATABASE_URL en .env.local')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

const USER_ID = 'user_3HCP…WxaITwRGT'
const EMAIL = 'untunadylan55@gmail.com'

async function main() {
  // 1. Insertar usuario
  await sql`
    INSERT INTO public.users (id, email)
    VALUES (${USER_ID}, ${EMAIL})
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
  `
  console.log(`✅ Usuario insertado: ${USER_ID} (${EMAIL})`)

  // 2. Insertar admin
  await sql`
    INSERT INTO public.admins (user_id)
    VALUES (${USER_ID})
    ON CONFLICT (user_id) DO NOTHING
  `
  console.log('✅ Admin registrado correctamente')

  // 3. Verificar
  const admin = await sql`SELECT * FROM public.admins WHERE user_id = ${USER_ID}`
  if (admin.length > 0) {
    console.log('🎉 Admin activo:', JSON.stringify(admin[0], null, 2))
  } else {
    console.error('❌ No se pudo verificar el admin')
  }
}

main().catch((e) => {
  console.error('❌ Error:', e.message)
  process.exit(1)
})
