import Link from 'next/link'
import { Sparkles, Package, Gift, LogOut, ArrowRight, Mail, Calendar } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { query, isDbConfigured } from '@/lib/db/neon'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCents, formatDate } from '@/lib/format'
import { ROUTES } from '@/lib/constants'

export const metadata = { title: 'Mi cuenta · Munay' }
export const dynamic = 'force-dynamic'

export default async function CuentaHomePage() {
  const user = await requireUser()

  let ordersCount = 0
  let totalSpent = 0
  let lastOrderDate: string | null = null
  let recentOrders: Array<{ id: string; status: string; total_cents: number; created_at: string }> = []

  if (isDbConfigured()) {
    // Fix CRIT-4: query directa Neon.
    const orders = await query<any>(`
      SELECT id, status, total_cents, created_at
      FROM orders
      WHERE user_id = $1 OR customer_email = $2
      ORDER BY created_at DESC
      LIMIT 5
    `, [user.id, user.email])

    recentOrders = orders.map((o) => ({
      id: o.id,
      status: o.status,
      total_cents: Number(o.total_cents),
      created_at: o.created_at,
    }))

    ordersCount = recentOrders.length
    totalSpent = recentOrders
      .filter((o) => o.status === 'paid')
      .reduce((s, o) => s + o.total_cents, 0)
    lastOrderDate = recentOrders[0]?.created_at ?? null
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-primary">Pagada</Badge>
      case 'cancelled': return <Badge variant="destructive">Cancelada</Badge>
      case 'refunded': return <Badge variant="secondary">Reembolsada</Badge>
      default: return <Badge variant="outline">Pendiente</Badge>
    }
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Badge variant="secondary" className="mb-2">Mi cuenta</Badge>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Mi cuenta</h1>
          <p className="mt-2 text-muted-foreground flex items-center gap-2">
            <Mail className="h-4 w-4" aria-hidden />
            {user.email}
          </p>
        </div>
        <form action="/api/auth/logout?next=/" method="POST">
          <Button type="submit" variant="outline">
            <LogOut className="mr-2 h-4 w-4" aria-hidden />
            Cerrar sesión
          </Button>
        </form>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4" aria-hidden />
              Puntos disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{user.points_balance ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              ≈ {formatCents(Math.floor((user.points_balance ?? 0) / 10) * 100)} en descuento
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" aria-hidden />
              Órdenes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{ordersCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {lastOrderDate ? `Última: ${formatDate(lastOrderDate, { dateStyle: 'medium' })}` : 'Sin órdenes aún'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Gift className="h-4 w-4" aria-hidden />
              Total gastado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCents(totalSpent)}</p>
            <p className="mt-1 text-xs text-muted-foreground">en órdenes pagadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/cuenta/ordenes">
            <Package className="mr-2 h-4 w-4" aria-hidden />
            Ver historial de órdenes
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/cuenta/puntos">
            <Sparkles className="mr-2 h-4 w-4" aria-hidden />
            Ver mis puntos
          </Link>
        </Button>
        <Button asChild>
          <Link href={ROUTES.catalogo}>
            Seguir comprando
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">Órdenes recientes</h2>
          {ordersCount > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/cuenta/ordenes">Ver todas</Link>
            </Button>
          )}
        </div>

        {recentOrders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Package className="h-10 w-10 text-muted-foreground" aria-hidden />
              <p className="text-muted-foreground">Aún no tienes órdenes.</p>
              <Button asChild>
                <Link href={ROUTES.catalogo}>Explorar catálogo</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((o) => (
              <Card key={o.id} className="border-border/60 hover:border-primary/40 transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" aria-hidden />
                    <div>
                      <p className="text-sm font-medium font-mono">{o.id.slice(0, 8)}…</p>
                      <p className="text-xs text-muted-foreground">{formatDate(o.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">{formatCents(o.total_cents)}</span>
                    {statusBadge(o.status)}
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/cuenta/ordenes/${o.id}`}>Ver</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
