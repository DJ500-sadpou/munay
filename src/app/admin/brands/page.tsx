import Link from 'next/link'
import { ArrowLeft, Tags } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listAllBrandsForAdmin } from '@/lib/queries/brands'
import { Button } from '@/components/ui/button'
import { BrandsManager } from '@/components/admin/brands-manager'

export const metadata = {
  title: 'Marcas · Admin · Munay',
}

export const dynamic = 'force-dynamic'

export default async function AdminBrandsPage() {
  await requireAdmin()
  const brands = await listAllBrandsForAdmin()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Volver al panel
        </Link>
      </Button>

      <div className="mb-8">
        <span className="mb-3 inline-block rounded-full bg-munay-terracota/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-munay-terracota">
          Admin
        </span>
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight text-munay-ink">
          <Tags className="h-7 w-7 text-munay-terracota" aria-hidden />
          Marcas
        </h1>
        <p className="mt-2 text-munay-ink/60">
          Gestiona las marcas del catálogo. Una marca inactiva no puede asignarse a
          productos nuevos, pero no rompe los que ya la tienen.
        </p>
      </div>

      <BrandsManager initialBrands={brands} />
    </div>
  )
}
