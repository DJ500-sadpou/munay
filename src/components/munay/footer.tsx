import Link from 'next/link'
import Image from 'next/image'
import { SITE, ROUTES } from '@/lib/constants'

const COLUMNS = [
  {
    title: 'Comprar',
    links: [
      { label: 'Catálogo', href: ROUTES.catalogo },
      { label: 'Cupones y ofertas', href: '/#cupones-y-ofertas' },
      { label: 'Carrito', href: ROUTES.carrito },
    ],
  },
  {
    title: 'Vender',
    links: [
      { label: 'Publicar prenda', href: '/publicar' },
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
      { label: 'Soporte', href: '/soporte' },
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

// SVGs inline que aceptan y propagan props (className, aria-hidden, etc.)
const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
    <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1Z" />
    <path d="M14 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1Z" />
    <path d="M9.5 13.5c.5 1 1.5 1.5 2.5 1.5s2-.5 2.5-1.5" />
  </svg>
)

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
)

const TikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
)

const SOCIAL = [
  { label: 'WhatsApp', icon: WhatsAppIcon, href: SITE.whatsappLink },
  { label: 'Instagram', icon: InstagramIcon, href: SITE.instagram },
  { label: 'TikTok', icon: TikTokIcon, href: SITE.tiktok },
]

export function MunayFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-black/5 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <div className="flex items-start gap-4">
              <div>
                <span className="font-display text-2xl font-extrabold tracking-tight text-munay-terracota">
                  MUNAY
                </span>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-munay-cacao/70">
                  Para estar pinta
                </p>
                <p className="mt-4 max-w-xs text-xs leading-relaxed text-munay-ink/60">
                  Moda circular, nueva y usada. Confianza que se siente.
                </p>
              </div>
              {/* Código QR — escaneá y entrá a la moda circular */}
              <div className="relative mt-1 h-20 w-20 shrink-0">
                <Image
                  src="/munay/ref-qr.webp"
                  alt="Escaneá para ir a Munay"
                  fill
                  sizes="80px"
                  className="object-contain"
                />
              </div>
            </div>
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
                      className="text-xs text-munay-ink/60 transition-colors hover:text-munay-terracota"
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
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-black/5 bg-munay-crema/20 text-munay-ink/60 transition-colors hover:text-munay-terracota"
                  >
                    <s.icon aria-hidden />
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
