import { SignIn } from '@clerk/nextjs'

export const metadata = { title: 'Mi cuenta · Munay' }

export default function UserLoginPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-munay-ink">Mi cuenta</h1>
          <p className="mt-2 text-sm text-munay-ink/60">
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
              card: 'shadow-sm border-black/5',
              headerTitle: 'font-display',
              headerSubtitle: 'text-munay-ink/60',
            },
          }}
        />
        <p className="mt-6 text-center text-xs text-munay-ink/60">
          ¿Eres admin?{' '}
          <a href="/admin/login" className="text-munay-red-600 underline hover:no-underline">
            Acceder al panel admin
          </a>
        </p>
      </div>
    </div>
  )
}
