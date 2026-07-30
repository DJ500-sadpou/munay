/**
 * Cloudinary SDK Wrapper — Imágenes de producto
 *
 * Fase 1.1 del plan Cloudinary.
 * Provee: subir archivo, eliminar, generar URL optimizada, y firma para Upload Widget.
 *
 * Las restricciones de seguridad (max_file_size, allowed_formats) se aplican
 * tanto aquí como en la firma del Upload Widget.
 */

import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const PRODUCTS_FOLDER = process.env.CLOUDINARY_PRODUCTS_FOLDER ?? 'munay/products'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sanitizar nombre de archivo: solo alfanumérico, guiones y guiones bajos */
function sanitizeFileName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')       // quitar extensión
    .replace(/[^a-zA-Z0-9_-]/g, '') // solo caracteres seguros
    .slice(0, 60)                   // límite de longitud
    || 'img'                        // fallback
}

// ---------------------------------------------------------------------------
// Upload (server-side)
// ---------------------------------------------------------------------------

/**
 * Subir imagen de producto desde el servidor.
 * Útil para migración bulk desde script.
 */
export async function uploadProductImage(
  fileBuffer: Buffer,
  fileName: string,
  productId: string,
): Promise<{ publicId: string; secureUrl: string }> {
  const safeName = sanitizeFileName(fileName)
  const timestamp = Date.now()

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: PRODUCTS_FOLDER,
        public_id: `${productId}/${timestamp}-${safeName}`,
        use_filename: false,
        unique_filename: true,
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload failed'))
        else resolve({ publicId: result.public_id, secureUrl: result.secure_url })
      },
    )
    uploadStream.end(fileBuffer)
  })
}

// ---------------------------------------------------------------------------
// URL optimizada
// ---------------------------------------------------------------------------

/**
 * Generar URL de Cloudinary con transformaciones de optimización.
 * Usar en frontend para servir imágenes responsivas.
 */
export function getOptimizedImageUrl(publicId: string, width = 600): string {
  return cloudinary.url(publicId, {
    transformation: [
      { width, crop: 'fill', gravity: 'auto', quality: 'auto', fetch_format: 'auto' },
    ],
  })
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/** Eliminar imagen de Cloudinary por su public_id */
export async function deleteProductImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}

/**
 * Extraer public_id de una secure_url de Cloudinary.
 * Útil cuando el widget devuelve secure_url y necesitamos el public_id.
 * Ej: https://res.cloudinary.com/.../v1234/munay/products/abc.jpg → munay/products/abc
 */
export function extractPublicIdFromUrl(secureUrl: string): string | null {
  // Formato típico: https://res.cloudinary.com/<cloud>/image/upload/v<version>/<folder>/<id>.<ext>
  try {
    const url = new URL(secureUrl)
    const segments = url.pathname.split('/')
    // Buscar "upload" en el path — después viene /v<version>/<folder>/<id>
    const uploadIndex = segments.indexOf('upload')
    if (uploadIndex === -1) return null
    const pathAfterVersion = segments.slice(uploadIndex + 2).join('/') // salta "upload" y "v<version>"
    return pathAfterVersion.replace(/\.[^.]+$/, '') // quitar extensión
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Firma firmada para Upload Widget (client-side upload)
// ---------------------------------------------------------------------------

/**
 * Generar firma para upload desde cliente (Upload Widget de Cloudinary).
 * Incluye restricciones de seguridad para evitar abuso:
 * - max_file_size: 5 MB
 * - allowed_formats: jpg, jpeg, png, webp
 * - transformation forzada en server
 */
export function generateUploadSignature(): {
  signature: string
  timestamp: number
  params: Record<string, any>
} {
  const timestamp = Math.round(Date.now() / 1000)
  const params: Record<string, any> = {
    timestamp,
    folder: PRODUCTS_FOLDER,
    max_file_size: 5 * 1024 * 1024, // 5 MB
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    max_image_width: 4096,
    max_image_height: 4096,
    transformation: 'w_1200,h_1200,c_limit,q_auto,f_auto',
  }
  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET!,
  )
  return { signature, timestamp, params }
}
