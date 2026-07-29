import Link from 'next/link'
import { Sparkles, Mail, MapPin } from 'lucide-react'
import { SITE, ROUTES } from '@/lib/constants'

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-auto border-t border-border/60 bg-secondary/40">
      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          {/* Marca */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <span className="font-display text-lg font-semibold">{SITE.name}</span>
            </div>
            <p className="text-sm text-muted-foreground">{SITE.description}</p>
          </div>

          {/* Tienda */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/80">
              Tienda
            </h3>
            <ul className="space-y-2 text-sm">
              <li><Link href={ROUTES.catalogo} className="text-muted-foreground hover:text-primary transition-colors">Catálogo</Link></li>
              <li><Link href="/flash" className="text-muted-foreground hover:text-primary transition-colors">Ofertas flash</Link></li>
              <li><Link href={ROUTES.carrito} className="text-muted-foreground hover:text-primary transition-colors">Carrito</Link></li>
              <li><Link href={ROUTES.checkout} className="text-muted-foreground hover:text-primary transition-colors">Checkout</Link></li>
            </ul>
          </div>

          {/* Ayuda */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/80">
              Ayuda
            </h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Envíos</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Devoluciones</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Programa de puntos</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Términos y privacidad</Link></li>
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/80">
              Contacto
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{SITE.city}</span>
              </li>
              <li className="flex items-start gap-2 text-muted-foreground">
                <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <a href={`mailto:${SITE.email}`} className="hover:text-primary transition-colors">
                  {SITE.email}
                </a>
              </li>
              <li className="text-muted-foreground">WhatsApp: {SITE.whatsapp}</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground">
          © {year} {SITE.name}. Hecho con intención en {SITE.city}.
        </div>
      </div>
    </footer>
  )
}
