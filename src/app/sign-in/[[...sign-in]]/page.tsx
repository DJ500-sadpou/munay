import { SignIn } from "@clerk/nextjs";

export const metadata = { title: 'Iniciar sesión · Munay' }

export default function SignInPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-semibold text-munay-ink text-center mb-6">Iniciar sesión</h1>
        <SignIn />
      </div>
    </div>
  );
}
