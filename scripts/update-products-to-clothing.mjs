/**
 * Actualiza los 4 productos existentes (místicos) a prendas de vestir.
 *
 * Migración:
 *   amazonita-pulida      → Camiseta artesanal de algodón orgánico
 *   cuenco-ceremonial     → Chaqueta vaquera vintage
 *   palo-santo-kg         → Pantalón de lino ecológico
 *   colgante-cuarzo-cristal → Gorro tejido a mano
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

const updates = [
  {
    slug: 'amazonita-pulida',
    title: 'Camiseta artesanal de algodón orgánico — talla M',
    description: 'Camiseta de algodón orgánico 100%, tejida a mano por artesanos locales. Corte recto, talla M. Color: crudo natural. Perfecta para el día a día con un estilo sostenible y único.',
    price_cents: 300, // /5
    condition: 'new',
    grading: null,
  },
  {
    slug: 'cuenco-ceremonial-ceramica-negra',
    title: 'Chaqueta vaquera vintage — talla L',
    description: 'Chaqueta vaquera de segunda mano en buen estado. Auténtico denim de los años 90. Talla L, corte clásico. Ideal para un look casual con historia. Lavada y revisada.',
    price_cents: 700, // /5
    condition: 'used',
    grading: 'buena',
  },
  {
    slug: 'palo-santo-kg',
    title: 'Pantalón de lino ecológico — talla 40',
    description: 'Pantalón de lino 100% ecológico. Fresco, ligero y transpirable. Talla 40 (M). Corte recto, cintura elástica. Color: beige natural. Nuevo con etiqueta.',
    price_cents: 560, // /5
    condition: 'new',
    grading: null,
  },
  {
    slug: 'colgante-cuarzo-cristal',
    title: 'Gorro tejido a mano — lana merina',
    description: 'Gorro de lana merina 100%, tejido a mano. Talla única, diseño clásico. Color: gris perla. Suave, cálido y sostenible. Hecho por artesanas locales.',
    price_cents: 200, // /5
    condition: 'new',
    grading: null,
  },
]

for (const u of updates) {
  await sql`
    UPDATE products
    SET
      title = ${u.title},
      description = ${u.description},
      price_cents = ${u.price_cents},
      condition = ${u.condition}::text::product_condition,
      grading = ${u.grading}::text::product_grading
    WHERE slug = ${u.slug}
  `
  console.log(`✅ ${u.slug} → ${u.title}`)
}

console.log('🎉 Todos los productos actualizados a prendas de vestir.')
