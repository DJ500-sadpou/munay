import Link from 'next/link'
import { ArrowLeft, Plus, Ticket, Percent, Calendar, Repeat } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getAllCoupons } from '@/lib/queries/coupons'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCents, formatDate } from '@/lib/format'
import { CouponActions } from '@/components/admin/coupons/coupon-actions'

export const metadata = { title: 'Cupones · Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminCouponsPage() {
  await requireAdmin()

  const coupons = await getAllCoupons()

  const now = new Date()
  const statusOf = (c: (typeof coupons)[number]) => {
    if (c.usos_maximos !== null && c.usos_actuales >= c.usos_maximos) return 'agotado'
    if (!c.activo) return 'inactivo'
    if (now < new Date(c.fecha_inicio)) return 'programado'
    if (now > new Date(c.fecha_fin)) return 'expirado'
    return 'vigente'
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
          <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink">Cupones</h1>
          <p className="mt-2 text-munay-ink/60">
            {coupons.length} {coupons.length === 1 ? 'cupón' : 'cupones'} configurados. Se aplican en el checkout.
          </p>
        </div>
        <Button asChild className="bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
          <Link href="/admin/coupons/new">
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Nuevo cupón
          </Link>
        </Button>
      </div>

      {coupons.length === 0 ? (
        <Card className="border-dashed border-black/10">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Ticket className="h-10 w-10 text-munay-ink/30" aria-hidden />
            <p className="text-munay-ink/60">
              Aún no hay cupones. Crea el primero para ofrecer descuentos en el checkout.
            </p>
            <Button asChild className="bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
              <Link href="/admin/coupons/new">
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
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-right font-medium">Descuento</th>
                <th className="px-4 py-3 text-right font-medium">Mínimo</th>
                <th className="px-4 py-3 text-center font-medium">Usos</th>
                <th className="px-4 py-3 text-left font-medium">Vigencia</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {coupons.map((c) => {
                const status = statusOf(c)
                return (
                  <tr key={c.id} className="hover:bg-munay-crema/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold">{c.codigo}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.tipo === 'primera_compra' ? 'secondary' : 'outline'}>
                        {c.tipo === 'primera_compra' ? 'Primera compra' : 'General'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {c.porcentaje_descuento}%
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-munay-ink/60">
                      {formatCents(c.monto_minimo_compra)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1">
                        <Repeat className="h-3 w-3 text-muted-foreground" aria-hidden />
                        {c.usos_actuales}
                        {c.usos_maximos !== null ? ` / ${c.usos_maximos}` : ''}
                      </span>
                      {status === 'agotado' && (
                        <Badge variant="destructive" className="ml-2">Agotado</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-munay-ink/60">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" aria-hidden />
                        {formatDate(c.fecha_inicio, { dateStyle: 'short' })}
                        {' → '}
                        {formatDate(c.fecha_fin, { dateStyle: 'short' })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {status === 'vigente' ? (
                        <Badge className="bg-primary">Vigente</Badge>
                      ) : status === 'agotado' ? (
                        <Badge variant="destructive">Agotado</Badge>
                      ) : status === 'inactivo' ? (
                        <Badge variant="outline">Inactivo</Badge>
                      ) : status === 'programado' ? (
                        <Badge variant="outline">Programado</Badge>
                      ) : (
                        <Badge variant="destructive">Expirado</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/coupons/${c.id}`}>Editar</Link>
                      </Button>
                      <CouponActions couponId={c.id} />
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
          <Percent className="h-4 w-4" aria-hidden />
          <span>
            Los cupones son independientes de los{' '}
            <Link href="/admin/flash-codes" className="underline">códigos flash</Link> (descubrimiento de
            productos). Si la tabla <code className="rounded bg-munay-crema/30 px-1">coupons</code> no
            existe aún, ejecuta la migración <code className="rounded bg-munay-crema/30 px-1">00020</code> en Neon.
          </span>
        </p>
      </div>
    </div>
  )
}
