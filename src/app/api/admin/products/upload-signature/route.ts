/**
 * POST /api/admin/products/upload-signature
 *
 * Genera una firma firmada para el Upload Widget de Cloudinary.
 * Solo admins autenticados. Rate limiting por IP.
 *
 * @returns { signature, timestamp, cloudName, apiKey, folder, maxFileSize, allowedFormats }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { checkAdminRow } from '@/lib/auth/admin-checks'
import { generateUploadSignature } from '@/lib/storage/cloudinary'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Rate limiter simple (en memoria)
// ---------------------------------------------------------------------------
const ipTimestamps = new Map<string, number>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const last = ipTimestamps.get(ip) ?? 0
  if (now - last < 1000) return false // máximo 1 request/segundo por IP
  ipTimestamps.set(ip, now)

  // Limpiar entries viejas cada ~1000 IPs
  if (ipTimestamps.size > 1000) {
    const cutoff = now - 60_000
    for (const [key, val] of ipTimestamps) {
      if (val < cutoff) ipTimestamps.delete(key)
    }
  }
  return true
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // 1. Autenticación
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // 2. Verificar admin
  const isAdmin = await checkAdminRow(userId)
  if (!isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // 3. Rate limiting por IP
  const ip = req.headers.get('x-forwarded-for')
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Espera un segundo.' },
      { status: 429 },
    )
  }

  // 4. Generar firma con restricciones
  if (!process.env.CLOUDINARY_API_KEY || !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
    return NextResponse.json(
      { error: 'Cloudinary no está configurado. Completa las env vars.' },
      { status: 503 },
    )
  }

  const { signature, timestamp, params } = generateUploadSignature()

  return NextResponse.json({
    ok: true,
    signature,
    timestamp,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder: params.folder,
    maxFileSize: params.max_file_size,
    allowedFormats: params.allowed_formats,
  })
}
