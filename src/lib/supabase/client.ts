/**
 * STUB de compatibilidad — Supabase browser client.
 *
 * Tras migrar a Clerk para auth, este cliente ya no es Supabase.
 * Retorna un objeto mínimo para que el código existente que usa
 * `createBrowserClient().auth.signInWithPassword()` etc. funcione
 * redirigiendo a las páginas de Clerk.
 *
 * @deprecated Para auth en cliente, usar Clerk directamente:
 *   import { useUser, useClerk } from '@clerk/nextjs'
 */

export function createBrowserClient() {
  return {
    auth: {
      signInWithPassword: async (_creds: any) => {
        // Redirigir a Clerk sign-in
        if (typeof window !== 'undefined') {
          window.location.href = '/cuenta/login'
        }
        return { data: { user: null }, error: null }
      },
      signInWithOtp: async (_params: any) => {
        if (typeof window !== 'undefined') {
          window.location.href = '/cuenta/login'
        }
        return { data: { user: null }, error: null }
      },
      signUp: async (_params: any) => {
        if (typeof window !== 'undefined') {
          window.location.href = '/cuenta/login'
        }
        return { data: { user: null, session: null }, error: null }
      },
      signOut: async () => {
        if (typeof window !== 'undefined') {
          window.location.href = '/api/auth/logout'
        }
      },
      getUser: async () => ({ data: { user: null }, error: null }),
      exchangeCodeForSession: async (_code: string) => {
        return { error: { message: 'Usar Clerk callback' } }
      },
      onAuthStateChange: (_cb: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  }
}
