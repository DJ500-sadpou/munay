import { requireAdmin } from '@/lib/auth/require-admin'
import { FlashCodeForm } from '@/components/admin/flash-codes/flash-code-form'

export const metadata = { title: 'Nuevo código flash · Admin' }
export const dynamic = 'force-dynamic'

export default async function NewFlashCodePage() {
  await requireAdmin()
  return <FlashCodeForm />
}
