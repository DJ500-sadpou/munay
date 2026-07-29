import { SignIn } from '@clerk/nextjs'

export const metadata = { title: 'Mi cuenta · Munay' }

export default function UserLoginPage() {
  return (
    <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-semibold">Mi cuenta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Inicia sesión para ver tus órdenes y puntos.
          </p>
        </div>
        <SignIn
          routing="hash"
          forceRedirectUrl="/cuenta"
          fallbackRedirectUrl="/cuenta"
          appearance={{
            elements: {
              rootBox: 'mx-auto w-full',
              card: 'shadow-md border-border/60',
              headerTitle: 'font-display',
              headerSubtitle: 'text-muted-foreground',
            },
          }}
        />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Eres admin?{' '}
          <a href="/admin/login" className="text-primary underline hover:no-underline">
            Acceder al panel admin
          </a>
        </p>
      </div>
    </div>
  )
}
