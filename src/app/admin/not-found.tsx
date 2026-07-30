import Link from 'next/link'
import { ShieldAlert, ArrowLeft, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function AdminNotFound() {
  return (
    <div className="container mx-auto flex min-h-[70vh] items-center justify-center px-4 py-10">
      <Card className="mx-auto max-w-md border-destructive/30 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-8 w-8 text-destructive" aria-hidden />
          </div>
          <CardTitle className="text-2xl">Acceso denegado</CardTitle>
          <CardDescription className="text-base">
            No tienes permisos de administrador en este sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted/50 p-4 text-sm">
            <p className="mb-2 flex items-center gap-2 font-medium">
              <Database className="h-4 w-4" aria-hidden />
              Posibles causas:
            </p>
            <ol className="ml-5 list-decimal space-y-1 text-muted-foreground">
              <li>Tu usuario de Clerk no está registrado en la tabla <code className="rounded bg-muted px-1">public.users</code></li>
              <li>Tu <code className="rounded bg-muted px-1">user_id</code> no está en la tabla <code className="rounded bg-muted px-1">public.admins</code></li>
              <li>La conexión a la base de datos no está disponible</li>
            </ol>
          </div>

          <div className="rounded-md bg-accent/10 p-4 text-sm">
            <p className="font-medium mb-1">¿Eres el administrador?</p>
            <p className="text-muted-foreground">
              Ve al SQL Editor de Neon y ejecuta:
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-[10px] leading-relaxed">
{`INSERT INTO public.users (id, email)
VALUES ('user_xxx', 'tu@email.com')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

INSERT INTO public.admins (user_id)
VALUES ('user_xxx')
ON CONFLICT (user_id) DO NOTHING;`}
            </pre>
            <p className="mt-2 text-xs text-muted-foreground">
              Reemplaza <code className="rounded bg-muted px-1">user_xxx</code> con tu Clerk User ID.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button asChild variant="default" className="flex-1">
              <Link href="/admin/login">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                Ir al login
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/">
                Volver al inicio
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
