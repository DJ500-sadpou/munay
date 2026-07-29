import { requireAdmin } from '@/lib/auth/require-admin'
import { ProductForm } from '@/components/admin/product-form'

export const metadata = { title: 'Nuevo producto · Admin' }

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  await requireAdmin()
  return <ProductForm />
}
