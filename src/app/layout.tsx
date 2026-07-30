import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { WhatsAppFloat } from "@/components/support/whatsapp-float";
import { SITE } from "@/lib/constants";
import { ClerkProvider } from "@clerk/nextjs";

// Fix FLOW3-003: Verificar si Clerk está configurado antes de renderizar.
// Si falta NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, ClerkProvider lanza error.
// Envolvemos en un componente que captura el error y muestra un banner.
function ClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  // Fix FLOW3-003: Verificar si Clerk está configurado ANTES de renderizar ClerkProvider.
  // Si falta NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, ClerkProvider lanza error en producción.
  // El check es simple: debe existir y empezar con 'pk_' (formato de Clerk).
  const isClerkConfigured =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_')

  if (!isClerkConfigured) {
    return (
      <>
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-900 p-3 text-sm" role="alert">
          <strong>⚠️ Clerk no configurado:</strong> Falta{' '}
          <code className="bg-amber-200 px-1 rounded">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
          {' '}válida. El login de usuarios y panel admin no estarán disponibles.
          {' '}<a href="https://clerk.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Configurar Clerk →</a>
        </div>
        {children}
      </>
    )
  }

  return <ClerkProvider>{children}</ClerkProvider>
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const displaySerif = Playfair_Display({
  variable: "--font-display-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "ropa",
    "ropa usada",
    "ropa nueva",
    "Ibarra",
    "Ecuador",
    "segunda mano",
    "tienda de ropa",
    "munay",
  ],
  authors: [{ name: SITE.name }],
  openGraph: {
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: SITE.url,
    siteName: SITE.name,
    type: "website",
    locale: "es_EC",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProviderWrapper>
      <html lang="es-EC" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} font-sans antialiased bg-background text-foreground`}
        >
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
            <WhatsAppFloat />
          </div>
          <Toaster />
        </body>
      </html>
    </ClerkProviderWrapper>
  );
}
