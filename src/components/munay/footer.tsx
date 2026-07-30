import Link from 'next/link'
import { Instagram, Facebook, Twitter } from 'lucide-react'
import { SITE, ROUTES } from '@/lib/constants'

const COLUMNS = [
  {
    title: 'Comprar',
    links: [
      { label: 'Catálogo', href: ROUTES.catalogo },
      { label: 'Ofertas flash', href: '/flash' },
      { label: 'Carrito', href: ROUTES.carrito },
    ],
  },
  {
    title: 'Vender',
    links: [
      { label: 'Publicar prenda', href: ROUTES.miCuenta },
      { label: 'Mi cuenta', href: ROUTES.miCuenta },
      { label: 'Cómo funciona', href: '/#como-funciona' },
    ],
  },
  {
    title: 'Ayuda',
    links: [
      { label: 'Envíos', href: '/info' },
      { label: 'Devoluciones', href: '/info' },
      { label: 'Contacto', href: `mailto:${SITE.email}` },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Términos', href: '/info' },
      { label: 'Privacidad', href: '/info' },
    ],
  },
]

const SOCIAL = [
  { label: 'Instagram', icon: Instagram },
  { label: 'Facebook', icon: Facebook },
  { label: 'Twitter', icon: Twitter },
]

export function MunayFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-black/5 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <span className="font-display text-2xl font-extrabold tracking-tight text-munay-red-600">
              MUNAY
            </span>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-munay-red-800/70">
              Para estar pinta
            </p>
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-munay-ink/60">
              Moda circular, nueva y usada. Confianza que se siente.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-munay-ink">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-xs text-munay-ink/60 transition-colors hover:text-munay-red-600"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-munay-ink">
              Redes
            </h3>
            <ul className="mt-3 flex gap-2">
              {SOCIAL.map((s) => (
                <li key={s.label}>
                  <Link
                    href="#"
                    aria-label={s.label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-black/5 bg-munay-cream/20 text-munay-ink/60 transition-colors hover:text-munay-red-600"
                  >
                    <s.icon className="h-4 w-4" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-black/5 pt-6 text-xs text-munay-ink/50">
          © {year} {SITE.name}. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  )
}
