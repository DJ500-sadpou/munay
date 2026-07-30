/**
 * Recorta regiones específicas de la imagen de referencia para usarlas
 * como assets individuales en la landing page.
 *
 * Uso:
 *   1. Coloca la imagen de referencia en public/munay/reference.png
 *   2. Ejecuta: node scripts/crop-reference-assets.mjs
 *
 * La imagen de referencia original se descargó de:
 *   https://hebbkx1anhila5yf.public.blob.vercel-storage.com/freegpt-im-1785384455507-0-HOefADFayii4vP4M8zScwbcg9fNCgi.png
 *
 * Coordenadas calculadas para una imagen de 1024×1024 px.
 */

import sharp from 'sharp'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

const SRC = path.join(PROJECT_ROOT, 'public/munay/reference.png')
const OUT = path.join(PROJECT_ROOT, 'public/munay')

// Regiones recortadas del mockup de referencia (1024×1024)
const crops = [
  { name: 'ref-hero-models', left: 414, top: 54, width: 274, height: 290, scale: 4 },
  { name: 'ref-hero-phone', left: 786, top: 58, width: 144, height: 288, scale: 4 },
  { name: 'ref-flash-jacket', left: 228, top: 410, width: 160, height: 148, scale: 4 },
  { name: 'ref-live-woman', left: 830, top: 408, width: 136, height: 152, scale: 4 },
  { name: 'ref-app-phone', left: 60, top: 866, width: 122, height: 90, scale: 5 },
  { name: 'ref-qr', left: 866, top: 880, width: 62, height: 62, scale: 6 },
]

async function main() {
  const { existsSync } = await import('fs')
  if (!existsSync(SRC)) {
    console.error(`[crop] Error: no se encuentra ${SRC}`)
    console.error('[crop] Descarga la imagen de referencia desde la URL documentada y guárdala como public/munay/reference.png')
    process.exit(1)
  }

  for (const c of crops) {
    await sharp(SRC)
      .extract({ left: c.left, top: c.top, width: c.width, height: c.height })
      .resize({
        width: Math.round(c.width * c.scale),
        height: Math.round(c.height * c.scale),
        kernel: 'lanczos3',
      })
      .png({ quality: 100 })
      .toFile(`${OUT}/${c.name}.png`)
    console.log(`[crop] ✓ ${c.name}`)
  }
}

main().catch(console.error)
