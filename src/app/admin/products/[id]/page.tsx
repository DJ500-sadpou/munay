import { requireAdmin } from '@/lib/auth/require-admin'
import { queryOne, isDbConfigured } from '@/lib/db/neon'
import { ProductForm } from '@/components/admin/product-form'
import { listAllBrandsForAdmin } from '@/lib/queries/brands'
import { notFound } from 'next/navigation'

export const metadata = { title: 'Editar producto · Admin' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: PageProps) {
  await requireAdmin()

  if (!isDbConfigured()) notFound()

  const { id } = await params

  // Fix CRIT-4: query directa Neon (sin stub con select anidado).
  // [P1] Se traen también categoria y marca_id para el form.
  const p = await queryOne<any>(`
    SELECT
      p.id, p.slug, p.title, p.description, p.price_cents, p.condition, p.grading, p.active,
      p.categoria, p.marca_id,
      COALESCE(i.stock, 0) AS stock
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE p.id = $1
  `, [id])

  if (!p) notFound()

  // [P1] Todas las marcas (activas + inactivas) para que el form pueda
  // preseleccionar la marca actual aunque esté inactiva ([FIX R5]).
  const brands = (await listAllBrandsForAdmin()).map((b) => ({
    id: b.id,
    nombre: b.nombre,
    activo: b.activo,
  }))

  return (
    <ProductForm
      brands={brands}
      product={{
        id: p.id,
        slug: p.slug,
        title: p.title,
        description: p.description,
        price_cents: Number(p.price_cents),
        condition: p.condition,
        grading: p.grading,
        active: p.active,
        stock: Number(p.stock ?? 0),
        categoria: p.categoria,
        marca_id: p.marca_id,
      }}
    />
  )
}
