import Link from 'next/link'
import { ArrowLeft, Sparkles, TrendingUp, TrendingDown, History, Gift } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { queryOne, query, isDbConfigured } from '@/lib/db/neon'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatCents, formatDate } from '@/lib/format'
import { POINTS_RULES } from '@/lib/constants'

export const metadata = { title: 'Mis puntos · Munay' }
export const dynamic = 'force-dynamic'

export default async function MyPointsPage() {
  const user = await requireUser('/cuenta/puntos')

  let balance = 0
  let transactions: Array<{
    id: string
    type: string
    points: number
    note: string | null
    created_at: string
    order_id: string | null
  }> = []
  let totalEarned = 0
  let totalRedeemed = 0

  if (isDbConfigured()) {
    // Fix CRIT-4: query directa con Neon.
    const customer = await queryOne<any>(`
      SELECT id FROM customers WHERE user_id = $1 OR email = $2 LIMIT 1
    `, [user.id, user.email])

    if (customer) {
      const txData = await query<any>(`
        SELECT id, type, points, note, created_at, order_id
        FROM point_transactions
        WHERE customer_id = $1
        ORDER BY created_at DESC
      `, [customer.id])

      transactions = txData.map((t) => ({
        id: t.id,
        type: t.type,
        points: Number(t.points),
        note: t.note,
        created_at: t.created_at,
        order_id: t.order_id,
      }))

      balance = transactions.reduce((s, t) => s + t.points, 0)
      totalEarned = transactions.filter((t) => t.type === 'earn').reduce((s, t) => s + t.points, 0)
      totalRedeemed = Math.abs(
        transactions.filter((t) => t.type === 'redeem').reduce((s, t) => s + t.points, 0)
      )
    }
  }

  const typeMeta = (type: string) => {
    switch (type) {
      case 'earn':
        return { label: 'Ganado', icon: TrendingUp, color: 'text-primary' }
      case 'redeem':
        return { label: 'Redimido', icon: TrendingDown, color: 'text-destructive' }
      case 'adjust':
        return { label: 'Ajuste', icon: Sparkles, color: 'text-accent' }
      default:
        return { label: type, icon: Sparkles, color: 'text-muted-foreground' }
    }
  }

  return (
    <div className="bg-gradient-to-b from-white via-munay-crema/10 to-white">
      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link href="/cuenta">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Volver a mi cuenta
          </Link>
        </Button>

        <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink mb-2">Mis puntos</h1>
        <p className="text-munay-ink/60 mb-8">
          Gana 1 punto por cada $1 gastado. Cada {POINTS_RULES.POINTS_PER_DISCOUNT_DOLLAR} puntos = $1 de descuento.
        </p>

        <Card className="border-munay-terracota/15 bg-munay-terracota/5 shadow-sm">
          <CardContent className="p-8 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-munay-terracota" aria-hidden />
            <p className="mt-3 text-xs uppercase tracking-wider text-munay-ink/60">Saldo disponible</p>
            <p className="mt-1 text-5xl font-bold text-munay-terracota">{balance}</p>
            <p className="mt-2 text-sm text-munay-ink/60">
              Equivalente a <strong className="text-munay-ink">{formatCents(Math.floor(balance / 10) * 100)}</strong> en descuento
            </p>
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card className="border-black/5 shadow-sm">
            <CardContent className="flex items-center gap-4 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-munay-red-500/10 text-munay-terracota">
                <TrendingUp className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs text-munay-ink/60">Total ganado</p>
                <p className="text-2xl font-bold text-munay-ink">+{totalEarned}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-black/5 shadow-sm">
            <CardContent className="flex items-center gap-4 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-munay-red-500/10 text-munay-terracota">
                <TrendingDown className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs text-munay-ink/60">Total redimido</p>
                <p className="text-2xl font-bold text-munay-ink">−{totalRedeemed}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 border-dashed border-black/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-munay-ink/60 flex items-center gap-2">
              <Gift className="h-4 w-4" aria-hidden />
              Cómo funcionan los puntos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-munay-ink/60">
            <p>• Ganas <strong className="text-munay-ink">1 punto por cada $1</strong> real pagado en una orden.</p>
            <p>• Cada <strong className="text-munay-ink">{POINTS_RULES.POINTS_PER_DISCOUNT_DOLLAR} puntos</strong> equivalen a <strong className="text-munay-ink">$1 de descuento</strong> en tu próxima compra.</p>
            <p>• Puedes redimirlos en el checkout (mínimo {POINTS_RULES.MIN_POINTS_TO_REDEEM} puntos).</p>
            <p>• Los puntos se acreditan automáticamente tras confirmar el pago.</p>
          </CardContent>
        </Card>

        <div className="mt-8">
          <h2 className="font-display text-xl font-semibold text-munay-ink mb-4 flex items-center gap-2">
            <History className="h-5 w-5" aria-hidden />
            Historial de movimientos
          </h2>

          {transactions.length === 0 ? (
            <Card className="border-dashed border-black/10">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Sparkles className="h-10 w-10 text-munay-ink/30" aria-hidden />
                <p className="text-munay-ink/60">
                  Aún no tienes movimientos de puntos.
                </p>
                <Button asChild className="bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
                  <Link href="/catalogo">Haz tu primera compra</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {transactions.map((t) => {
                const meta = typeMeta(t.type)
                return (
                  <Card key={t.id} className="border-black/5 shadow-sm">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-munay-crema/30 ${meta.color}`}>
                          <meta.icon className="h-4 w-4" aria-hidden />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-munay-ink">{meta.label}</p>
                          <p className="text-xs text-munay-ink/60">
                            {formatDate(t.created_at, { dateStyle: 'medium', timeStyle: 'short' })}
                            {t.note && ` · ${t.note}`}
                          </p>
                        </div>
                      </div>
                      <span className={`text-lg font-bold ${meta.color}`}>
                        {t.points > 0 ? '+' : ''}{t.points}
                      </span>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        <Separator className="my-8" />

        <Button asChild className="w-full sm:w-auto bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
          <Link href="/catalogo">
            <Sparkles className="mr-2 h-4 w-4" aria-hidden />
            Seguir acumulando puntos
          </Link>
        </Button>
      </div>
    </div>
  )
}
