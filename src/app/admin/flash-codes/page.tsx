import Link from 'next/link'
import { ArrowLeft, Plus, Unlock, Package, Zap } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { query, isDbConfigured } from '@/lib/db/neon'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCents } from '@/lib/format'

export const metadata = { title: 'Flash codes · Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminFlashCodesPage() {
  await requireAdmin()

  // F0/BLOQUE B: los códigos flash son SOLO 'unlock'. Las columnas
  // discount_percent/discount_cents ya no existen en flash_codes.
  // [F2.1] Resumen de productos asociados por fila vía array_agg (evita
  // N+1 de getUnlockedProducts por código).
  let flashCodes: Array<{
    code: string
    type: string
    starts_at: string
    ends_at: string
    max_uses: number | null
    uses_count: number
    active: boolean
    products: Array<{ title: string; precio_especial_cents: number | null; price_cents: number }>
  }> = []

  if (isDbConfigured()) {
    // Fix CRIT-4: query directa Neon.
    const rows = await query<any>(`
      SELECT
        fc.code, fc.type, fc.starts_at, fc.ends_at, fc.max_uses, fc.uses_count, fc.active,
        COALESCE((
          SELECT json_agg(json_build_object(
            'title', p.title,
            'precio_especial_cents', fcp.precio_especial_cents,
            'price_cents', p.price_cents
          ) ORDER BY p.title ASC)
          FROM flash_code_products fcp
          JOIN products p ON p.id = fcp.product_id
          WHERE fcp.code = fc.code
        ), '[]'::json) AS products
      FROM flash_codes fc
      ORDER BY fc.created_at DESC
    `)
    flashCodes = rows.map((r) => {
      // [FIX Ronda 1] El driver de Neon ya parsea json a arreglo JS; sin
      // try/catch innecesario (el fallback silencioso ocultaba errores reales).
      const products: Array<{ title: string; precio_especial_cents: number | null; price_cents: number }> =
        Array.isArray(r.products) ? r.products : []
      return {
        code: r.code,
        type: r.type,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
        max_uses: r.max_uses !== null ? Number(r.max_uses) : null,
        uses_count: Number(r.uses_count),
        active: r.active,
        products,
      }
    })
  }

  const now = new Date()
  const isLive = (fc: any) => {
    if (!fc.active) return false
    const start = new Date(fc.starts_at)
    const end = new Date(fc.ends_at)
    if (now < start || now > end) return false
    if (fc.max_uses !== null && fc.uses_count >= fc.max_uses) return false
    return true
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Volver al panel
        </Link>
      </Button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink">Códigos flash</h1>
          <p className="mt-2 text-munay-ink/60">
            {flashCodes.length} {flashCodes.length === 1 ? 'código' : 'códigos'} configurados.
          </p>
        </div>
        <Button asChild className="bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
          <Link href="/admin/flash-codes/new">
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Nuevo código
          </Link>
        </Button>
      </div>

      {flashCodes.length === 0 ? (
        <Card className="border-dashed border-black/10">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Zap className="h-10 w-10 text-munay-ink/30" aria-hidden />
            <p className="text-munay-ink/60">Aún no hay códigos flash.</p>
            <Button asChild className="bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
              <Link href="/admin/flash-codes/new">
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Crear el primero
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-black/5 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-munay-crema/30 text-xs uppercase tracking-wider text-munay-ink/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Código</th>
                <th className="px-4 py-3 text-center font-medium">Tipo</th>
                <th className="px-4 py-3 text-center font-medium">Usos</th>
                <th className="px-4 py-3 text-left font-medium">Productos</th>
                <th className="px-4 py-3 text-left font-medium">Vigencia</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {flashCodes.map((fc) => {
                const live = isLive(fc)
                return (
                  <tr key={fc.code} className="hover:bg-munay-crema/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold">{fc.code}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary">
                        <Unlock className="mr-1 h-3 w-3" aria-hidden />
                        Desbloqueo
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {fc.uses_count}{fc.max_uses != null ? ` / ${fc.max_uses}` : ''}
                    </td>
                    {/* [F2.1] Resumen de productos asociados + precio especial */}
                    <td className="px-4 py-3">
                      {fc.products.length === 0 ? (
                        <span className="text-xs text-munay-ink/40">Sin productos</span>
                      ) : (
                        <div className="max-w-[260px] space-y-1">
                          <p className="text-xs font-medium text-munay-ink/70">
                            {fc.products.length} {fc.products.length === 1 ? 'producto' : 'productos'}
                          </p>
                          {fc.products.slice(0, 2).map((pr, i) => {
                            const hasSpecial =
                              pr.precio_especial_cents != null &&
                              pr.precio_especial_cents > 0 &&
                              pr.precio_especial_cents < pr.price_cents
                            return (
                              <p key={i} className="truncate text-xs text-munay-ink/60">
                                {pr.title}
                                {hasSpecial && (
                                  <span className="ml-1 text-[10px] text-munay-terracota">
                                    ({formatCents(pr.precio_especial_cents!)})
                                  </span>
                                )}
                              </p>
                            )
                          })}
                          {fc.products.length > 2 && (
                            <p className="text-[10px] text-munay-ink/40">+{fc.products.length - 2} más</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-munay-ink/60">
                      {formatDate(fc.starts_at, { dateStyle: 'short' })}
                      {' → '}
                      {formatDate(fc.ends_at, { dateStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {live ? (
                        <Badge className="bg-primary">Vigente</Badge>
                      ) : !fc.active ? (
                        <Badge variant="outline">Inactivo</Badge>
                      ) : now < new Date(fc.starts_at) ? (
                        <Badge variant="outline">Programado</Badge>
                      ) : now > new Date(fc.ends_at) ? (
                        <Badge variant="destructive">Expirado</Badge>
                      ) : fc.max_uses !== null && fc.uses_count >= fc.max_uses ? (
                        <Badge variant="destructive">Agotado</Badge>
                      ) : (
                        <Badge variant="outline">—</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/flash-codes/${fc.code}`}>Editar</Link>
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-dashed border-black/10 bg-munay-crema/20 p-4 text-sm text-munay-ink/60">
        <p className="flex items-center gap-2">
          <Package className="h-4 w-4" aria-hidden />
          <span>
            Los códigos flash son de <strong>desbloqueo</strong>: asociar productos en la pestaña
            "Productos asociados" al editar un código. Los{' '}
            <Link href="/admin/coupons" className="underline">descuentos generales se gestionan en Cupones</Link>.
          </span>
        </p>
      </div>
    </div>
  )
}
