/**
 * Inserta el producto Mystery Box en Neon DB.
 * Precio: 0 (centinela para mostrar "???" en la UI)
 * Slug: mystery-box (no clickeable desde el catálogo)
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

// Verificar si ya existe
const existing = await sql`SELECT id FROM products WHERE slug = 'mystery-box'`
if (existing.length > 0) {
  console.log('ℹ️ Mystery Box ya existe, ID:', existing[0].id)
  process.exit(0)
}

// Insertar con price_cents = 0 (centinela para mostrar "???")
// No viola check constraint (price_cents >= 0)
const result = await sql`
  INSERT INTO products (slug, title, description, price_cents, currency, condition, active)
  VALUES (
    'mystery-box',
    '🎁 Mystery Box — Sorpresa',
    '¿Qué hay dentro? Una selección sorpresa de prendas seleccionadas especialmente para ti. El contenido exacto es... sorpresa. Disponible pronto.',
    0,
    'USD',
    'new',
    true
  )
  RETURNING id
`

// También agregar inventory
await sql`
  INSERT INTO inventory (product_id, stock, reserved)
  VALUES (${result[0].id}, 99, 0)
`

console.log('✅ Mystery Box creada, ID:', result[0].id)
