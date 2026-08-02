import { requireAdmin } from '@/lib/auth/require-admin'
import { ProductForm } from '@/components/admin/product-form'
import { listAllBrandsForAdmin } from '@/lib/queries/brands'

export const metadata = { title: 'Nuevo producto · Admin' }

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  await requireAdmin()
  // [P1] Marcas activas elegibles para asignar en el nuevo producto.
  const brands = (await listAllBrandsForAdmin())
    .filter((b) => b.activo)
    .map((b) => ({ id: b.id, nombre: b.nombre, activo: b.activo }))
  return <ProductForm brands={brands} />
}
