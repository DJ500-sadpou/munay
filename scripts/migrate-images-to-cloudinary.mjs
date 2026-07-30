/**
 * Script de migración bulk — Subir imágenes de producto a Cloudinary.
 *
 * Busca archivos de imagen en un directorio local, los sube a Cloudinary
 * y los asocia al producto correspondiente en la tabla product_images.
 *
 * Convención de nombres de archivo:
 *   <product-slug>__<nombre>.jpg
 *   Ej: camiseta-algodon-organico__frontal.jpg
 *        camiseta-algodon-organico__detalle-tejido.jpg
 *
 * Uso:
 *   node scripts/migrate-images-to-cloudinary.mjs [--dir ./public/products] [--dry-run] [--yes]
 *
 * Flags:
 *   --dir <path>   Directorio con las imágenes (default: ./public/products)
 *   --dry-run      Solo mostrar qué se subiría, sin ejecutar
 *   --help         Mostrar ayuda
 */

import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'
import { resolve, dirname, basename, extname, join } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { createHash } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env.local') })

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const help = args.includes('--help')
const dryRun = args.includes('--dry-run')

if (help) {
  console.log(`
📤 Script de migración bulk — Cloudinary para Munay

Busca imágenes locales y las sube a Cloudinary,
asociándolas al producto correspondiente.

Convención de nombres:
  <product-slug>__<descripcion>.(jpg|png|webp)
  Ej: camiseta-algodon-organico__frontal.jpg

Flags:
  --dir <path>   Directorio con imágenes (default: ./public/products)
  --dry-run      Solo mostrar qué se subiría (sin subir ni guardar)
  --yes          Ejecutar sin pedir confirmación
  --help         Mostrar esta ayuda
`)
  process.exit(0)
}

// Directorio de imágenes
const imgDirIndex = args.indexOf('--dir')
const IMG_DIR = imgDirIndex !== -1
  ? resolve(process.cwd(), args[imgDirIndex + 1])
  : resolve(process.cwd(), 'public', 'products')

// ---------------------------------------------------------------------------
// Configuración DB
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ Falta DATABASE_URL en .env.local')
  process.exit(1)
}
const sql = neon(DATABASE_URL)

// ---------------------------------------------------------------------------
// Configuración Cloudinary (solo en modo real)
// ---------------------------------------------------------------------------

let cloudinary: any = null

if (!dryRun) {
  const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const API_KEY = process.env.CLOUDINARY_API_KEY
  const API_SECRET = process.env.CLOUDINARY_API_SECRET

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    console.error('❌ Falta configuración de Cloudinary en .env.local')
    console.error('   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET')
    process.exit(1)
  }

  const { v2 } = await import('cloudinary')
  cloudinary = v2
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
  })

  // Verificar conexión
  try {
    const ping = await cloudinary.api.ping()
    console.log(`✅ Conectado a Cloudinary (status: ${ping.status})\n`)
  } catch (e: any) {
    console.error('❌ No se pudo conectar a Cloudinary:', e.message)
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRODUCTS_FOLDER = process.env.CLOUDINARY_PRODUCTS_FOLDER ?? 'munay/products'
const VALID_EXT = ['.jpg', '.jpeg', '.png', '.webp']

/** Extraer slug del nombre del archivo (todo lo que está antes del primer __) */
function extractSlug(filename: string): string | null {
  const name = basename(filename).replace(/\.[^.]+$/, '')
  const parts = name.split('__')
  const slug = parts.length >= 2 ? parts[0] : name
  // Validar que el slug sea alfanumérico con guiones (slugs válidos)
  if (!/^[a-z0-9][a-z0-9-]{2,118}[a-z0-9]$/i.test(slug) && slug !== 'mystery-box') {
    return null
  }
  return slug
}

/** Sanitizar nombre de archivo para Cloudinary */
function sanitizeName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60) || 'img'
}

/** Fingerprint del archivo para detectar duplicados */
function fileFingerprint(filePath: string): string {
  const content = readFileSync(filePath)
  return createHash('md5').update(content).digest('hex')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('📤 Migración bulk de imágenes a Cloudinary\n')
  console.log(`Modo:      ${dryRun ? '🔍 DRY RUN (solo simulación)' : '🚀 REAL'}`)
  console.log(`Directorio: ${IMG_DIR}`)
  console.log('')

  // 1. Obtener productos de la DB
  const products = await sql`
    SELECT id, slug, title FROM products
    ORDER BY created_at DESC
  `
  const productMap = new Map(products.map((p: any) => [p.slug, p]))
  console.log(`📦 ${products.length} productos en DB\n`)

  // 2. Escanear imágenes locales
  if (!existsSync(IMG_DIR)) {
    console.log(`📂 El directorio ${IMG_DIR} no existe.`)
    console.log('   Créalo y coloca las imágenes allí con el formato:')
    console.log('   <product-slug>__<descripcion>.(jpg|png|webp)\n')
    console.log('   Ej:')
    console.log('     public/products/camiseta-algodon-organico__frontal.jpg')
    console.log('     public/products/camiseta-algodon-organico__detalle.jpg')
    console.log('     public/products/chaqueta-vaquera-vintage__vista1.jpg\n')
    
    if (!dryRun) {
      console.log('ℹ️  Sin imágenes locales, nada que migrar.')
      console.log('   Usa el panel Admin → Nuevo producto → Upload Widget para subir imágenes.')
    }
    process.exit(0)
  }

  const files = readdirSync(IMG_DIR).filter(f => {
    const ext = extname(f).toLowerCase()
    return VALID_EXT.includes(ext)
  }).sort()

  if (files.length === 0) {
    console.log(`📂 No se encontraron imágenes en ${IMG_DIR}`)
    console.log('   Formatos aceptados: JPG, JPEG, PNG, WebP\n')
    process.exit(0)
  }

  console.log(`🖼️  ${files.length} imágenes encontradas\n`)

  // 3. Estadísticas
  let uploaded = 0
  let wouldUpload = 0 // dry-run counter
  let skipped = 0
  let errors = 0
  let noMatch = 0

  const seenFingerprints = new Set<string>()

  for (const file of files) {
    const filePath = join(IMG_DIR, file)
    const slug = extractSlug(file)
    const product = slug ? productMap.get(slug) : null

    if (!product) {
      console.log(`  ⏭️  ${file} → no coincide con ningún producto (slug: ${slug ?? '?'})`)
      noMatch++
      continue
    }

    // Validar tamaño de archivo (máx 5 MB, consistente con Upload Widget)
    const { size } = statSync(filePath)
    if (size > 5 * 1024 * 1024) {
      console.log(`  ⏭️  ${file} → excede 5 MB (${(size / 1024 / 1024).toFixed(1)} MB)`)
      skipped++
      continue
    }

    // Verificar si el producto ya tiene imágenes
    const existingCount = await sql`
      SELECT COUNT(*) as count FROM product_images WHERE product_id = ${product.id}
    `
    const hasImages = Number(existingCount[0].count) > 0

    // Detectar duplicados por fingerprint
    const fp = fileFingerprint(filePath)

    // Verificar si esta fingerprint ya se subió (misma imagen a otro producto)
    if (seenFingerprints.has(fp)) {
      console.log(`  ⏭️  ${file} → imagen duplicada (mismo contenido que otra ya procesada)`)
      skipped++
      continue
    }
    seenFingerprints.add(fp)

    // Determinar el sort basado en archivos existentes para este producto
    const nextSort = dryRun ? 0 : Number(existingCount[0].count)

    console.log(`  📤 ${file}`)
    console.log(`     → Producto: ${product.title} (${product.slug})`)
    console.log(`     → Sort: ${nextSort}${hasImages ? ' (ya tiene imágenes, se agrega al final)' : ''}`)

    if (!dryRun && cloudinary) {
      try {
        const buffer = readFileSync(filePath)
        const safeName = sanitizeName(file)
        const timestamp = Date.now()
        const publicId = `${product.id}/${timestamp}-${safeName}`

        // Subir a Cloudinary
        const uploadResult = await new Promise<any>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: PRODUCTS_FOLDER,
              public_id: publicId,
              transformation: [
                { width: 1200, height: 1200, crop: 'limit' },
                { quality: 'auto', fetch_format: 'auto' },
              ],
            },
            (error: any, result: any) => {
              if (error) reject(error)
              else resolve(result)
            },
          )
          uploadStream.end(buffer)
        })

        // Guardar en product_images
        await sql`
          INSERT INTO product_images (product_id, url, public_id, sort)
          VALUES (${product.id}, ${uploadResult.secure_url}, ${uploadResult.public_id}, ${nextSort})
        `

        console.log(`     ✅ Subida: ${uploadResult.secure_url}`)
        uploaded++
      } catch (err: any) {
        console.error(`     ❌ Error: ${err.message}`)
        errors++
      }
    } else if (dryRun) {
      console.log(`     🔍 [DRY RUN] Se subiría a Cloudinary (folder: ${PRODUCTS_FOLDER}/${product.id})`)
      wouldUpload++
    }
  }

  // 4. Resumen
  console.log('\n═══════════════════════════════════════')
  console.log('📊 RESUMEN')
  console.log('═══════════════════════════════════════')
  console.log(`  Total imágenes encontradas:   ${files.length}`)
  if (dryRun) {
    console.log(`  🔍 Se subirían:                ${wouldUpload}`)
    console.log(`  ⏭️  Sin producto asociado:     ${noMatch}`)
    console.log(`\n  Ejecuta sin --dry-run para realizar la migración real.`)
    console.log(`  O con --yes para saltar la confirmación.`)
  } else {
    console.log(`  ✅ Subidas:                    ${uploaded}`)
    console.log(`  ⏭️  Sin producto asociado:     ${noMatch}`)
    console.log(`  ⏭️  Omitidas (duplicadas/tamaño): ${skipped}`)
    console.log(`  ❌ Errores:                     ${errors}`)
    console.log(`\n  🎯 Resultado: ${uploaded > 0 ? `${uploaded} imágenes migradas a Cloudinary` : 'nada que migrar'}`)
  }
  console.log('')

  // 5. Mostrar productos que aún no tienen imágenes
  const stillMissing = await sql`
    SELECT p.slug, p.title
    FROM products p
    LEFT JOIN product_images pi ON pi.product_id = p.id
    WHERE pi.id IS NULL AND p.slug != 'mystery-box'
    ORDER BY p.created_at DESC
  `
  if (stillMissing.length > 0) {
    console.log(`📋 ${stillMissing.length} productos aún sin imágenes:`)
    for (const p of stillMissing) {
      console.log(`   - ${p.slug} → ${p.title}`)
    }
    console.log('')
    if (!dryRun && uploaded > 0) {
      console.log('💡 Usa el panel Admin → Editar producto → Upload Widget')
      console.log('   para subir imágenes de los productos restantes.\n')
    }
  }
}

main().catch((err) => {
  console.error('\n❌ Error fatal:', err)
  process.exit(1)
})
