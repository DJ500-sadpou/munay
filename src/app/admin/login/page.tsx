import { SignIn } from '@clerk/nextjs'

export const metadata = { title: 'Admin · Munay' }

export default function AdminLoginPage() {
  return (
    <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-semibold">Panel administrativo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acceso restringido. Inicia sesión con tu cuenta admin.
          </p>
        </div>
        <SignIn
          routing="hash"
          forceRedirectUrl="/admin"
          fallbackRedirectUrl="/admin"
          appearance={{
            elements: {
              rootBox: 'mx-auto w-full',
              card: 'shadow-md border-border/60',
              headerTitle: 'font-display',
              headerSubtitle: 'text-muted-foreground',
            },
          }}
        />

        <div className="mt-6 rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Configuración inicial de admin:</p>
          <ol className="mt-2 space-y-1 list-decimal list-inside">
            <li>Crea tu usuario en Clerk (vía /cuenta/login).</li>
            <li>Obtén tu <code className="rounded bg-muted px-1">user_id</code> (formato user_xxx) del dashboard Clerk.</li>
            <li>
              En Neon SQL Editor:
              <pre className="mt-1 rounded bg-muted p-2 text-[10px] overflow-x-auto">
{`INSERT INTO public.users (id, email) VALUES ('user_xxx', 'tu@email.com')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
INSERT INTO public.admins (user_id) VALUES ('user_xxx')
  ON CONFLICT (user_id) DO NOTHING;`}
              </pre>
            </li>
            <li>Inicia sesión aquí con ese usuario.</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
