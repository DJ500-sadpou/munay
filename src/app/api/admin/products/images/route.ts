/**
 * DELETE /api/admin/products/images
 *
 * Elimina una imagen de Cloudinary (por public_id) y de la DB.
 * Solo admins autenticados.
 *
 * Body: { publicId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { checkAdminRow } from '@/lib/auth/admin-checks'
import { deleteProductImage, extractPublicIdFromUrl } from '@/lib/storage/cloudinary'
import { query, isDbConfigured } from '@/lib/db/neon'

export const runtime = 'nodejs'

export async function DELETE(req: NextRequest) {
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

  // 3. Validar body
  let body: { publicId?: string; url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  let publicId: string | undefined = body.publicId?.trim()

  // Si no hay publicId pero hay url, extraerlo
  if (!publicId && body.url) {
    const extracted = extractPublicIdFromUrl(body.url)
    if (extracted) publicId = extracted
  }

  if (!publicId) {
    return NextResponse.json(
      { error: 'Se requiere publicId o url de Cloudinary' },
      { status: 400 },
    )
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'DB no configurada' }, { status: 503 })
  }

  // 4. Eliminar de la DB
  await query(`DELETE FROM product_images WHERE public_id = $1`, [publicId])

  // 5. Eliminar de Cloudinary
  try {
    await deleteProductImage(publicId)
  } catch (err: any) {
    console.warn('[admin/products/images] Error al eliminar de Cloudinary:', err.message)
    // No fallar si Cloudinary no responde — la imagen ya se eliminó de la DB
  }

  return NextResponse.json({ ok: true })
}
