import { Database, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Banner informativo: DB no está configurada.
 * (Renombrado desde SupabaseNotConfiguredBanner tras la migración a Neon.)
 */
export function DbNotConfiguredBanner() {
  return (
    <Card className="border-accent/40 bg-accent/10">
      <CardContent className="flex items-start gap-3 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
        <div className="text-sm">
          <p className="font-medium text-foreground">Base de datos no configurada</p>
          <p className="mt-1 text-muted-foreground">
            Esta página necesita credenciales reales para mostrar datos en vivo.
            Copia <code className="rounded bg-muted px-1.5 py-0.5">.env.example</code> a{' '}
            <code className="rounded bg-muted px-1.5 py-0.5">.env.local</code> y completa
            <code className="rounded bg-muted px-1.5 py-0.5">DATABASE_URL</code> con tu
            connection string de Neon. Luego aplica las migraciones en{' '}
            <code className="rounded bg-muted px-1.5 py-0.5">/supabase/migrations/</code>.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Database className="h-3 w-3" aria-hidden />
            Ver <code className="rounded bg-muted px-1">README.md</code> y{' '}
            <code className="rounded bg-muted px-1">docs/MIGRACION_NEON_BREVO.md</code> para instrucciones.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
