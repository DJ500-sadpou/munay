import { requireAdmin } from '@/lib/auth/require-admin'
import { queryOne, isDbConfigured } from '@/lib/db/neon'
import { FlashCodeForm } from '@/components/admin/flash-codes/flash-code-form'
import { notFound } from 'next/navigation'

export const metadata = { title: 'Editar código flash · Admin' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditFlashCodePage({ params }: PageProps) {
  await requireAdmin()

  if (!isDbConfigured()) notFound()

  const { id } = await params
  const code = decodeURIComponent(id).toUpperCase()

  // Fix CRIT-4: query directa Neon (sin stub).
  const fc = await queryOne<any>(`
    SELECT code, type, discount_percent, discount_cents, starts_at, ends_at, max_uses, uses_count, active
    FROM flash_codes WHERE code = $1
  `, [code])

  if (!fc) notFound()

  return (
    <FlashCodeForm
      flashCode={{
        code: fc.code,
        type: fc.type,
        discount_percent: fc.discount_percent !== null ? Number(fc.discount_percent) : null,
        discount_cents: fc.discount_cents !== null ? Number(fc.discount_cents) : null,
        starts_at: fc.starts_at,
        ends_at: fc.ends_at,
        max_uses: fc.max_uses !== null ? Number(fc.max_uses) : null,
        uses_count: Number(fc.uses_count),
        active: fc.active,
      }}
    />
  )
}
