'use client'

import Link from 'next/link'
import { Search, User, Heart, ShoppingBag, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useCart } from '@/store/cart'
import { useMounted } from '@/hooks/use-mounted'
import { UserMenu } from '@/components/layout/user-menu'
import { ROUTES } from '@/lib/constants'

const NAV_LINKS = [
  { href: ROUTES.catalogo, label: 'Comprar' },
  { href: '/flash', label: 'Ofertas Flash' },
  { href: '/flash', label: 'En vivo', live: true },
  { href: ROUTES.miCuenta, label: 'Vende tu ropa' },
  { href: '/#como-funciona', label: 'Cómo funciona' },
]

function Wordmark() {
  return (
    <Link href={ROUTES.home} className="flex flex-col leading-none">
      <span className="font-display text-2xl font-extrabold tracking-tight text-munay-terracota">
        MUNAY
      </span>
      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-munay-cacao/70">
        Para estar pinta
      </span>
    </Link>
  )
}

export function MunayHeader() {
  const mounted = useMounted()
  const totalItems = useCart((s) => s.lines.reduce((sum, l) => sum + l.qty, 0))

  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/5 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:px-6">
        <Wordmark />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-munay-ink/80 transition-colors hover:bg-munay-cream/30 hover:text-munay-terracota focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-munay-terracota"
            >
              {l.label}
              {l.live && (
                <Badge className="h-4 rounded-full bg-munay-terracota-quemado px-1.5 text-[9px] font-bold tracking-wide text-white hover:bg-munay-terracota-quemado">
                  LIVE
                </Badge>
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <form
            action={ROUTES.catalogo}
            className="relative hidden xl:block"
            role="search"
          >
            <label htmlFor="munay-search" className="sr-only">
              Buscar prendas
            </label>
            <Input
              id="munay-search"
              name="q"
              type="search"
              placeholder="Buscar prendas, marcas, looks…"
              className="h-10 w-72 rounded-full border-black/10 bg-munay-cream/15 pl-4 pr-10 text-sm placeholder:text-munay-ink/40 focus-visible:ring-munay-terracota/40"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full text-munay-ink/50 transition-colors hover:text-munay-terracota"
            >
              <Search className="h-4 w-4" aria-hidden />
            </button>
          </form>

          <div className="hidden items-center gap-1 sm:flex">
            <UserMenu />
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="rounded-full text-munay-ink/70 hover:text-munay-terracota"
            >
              <Link href={ROUTES.miCuenta} aria-label="Favoritos">
                <Heart className="h-5 w-5" aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="relative rounded-full text-munay-ink/70 hover:text-munay-terracota"
            >
              <Link href={ROUTES.carrito} aria-label="Carrito">
                <ShoppingBag className="h-5 w-5" aria-hidden />
                {mounted && totalItems > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-munay-terracota-quemado px-1 text-[10px] font-bold text-white">
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </Link>
            </Button>
          </div>

          <Button
            asChild
            className="hidden rounded-full bg-gradient-to-b from-munay-terracota to-munay-terracota-quemado px-5 text-sm font-semibold text-white shadow-sm hover:opacity-95 md:inline-flex"
          >
            <Link href={ROUTES.miCuenta}>Publicar prenda</Link>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full lg:hidden"
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] bg-white">
              <SheetHeader>
                <SheetTitle className="text-left text-munay-terracota">MUNAY</SheetTitle>
              </SheetHeader>
              <nav className="mt-4 flex flex-col gap-1 px-4">
                {NAV_LINKS.map((l) => (
                  <Link
                    key={`m-${l.label}`}
                    href={l.href}
                    className="rounded-lg px-2 py-2.5 text-sm font-medium text-munay-ink hover:bg-munay-cream/30"
                  >
                    {l.label}
                  </Link>
                ))}
                <Link
                  href={ROUTES.carrito}
                  className="rounded-lg px-2 py-2.5 text-sm font-medium text-munay-ink hover:bg-munay-cream/30"
                >
                  Carrito
                  {mounted && totalItems > 0 ? ` (${totalItems})` : ''}
                </Link>
                <Link
                  href={ROUTES.miCuenta}
                  className="rounded-lg px-2 py-2.5 text-sm font-medium text-munay-ink hover:bg-munay-cream/30"
                >
                  Mi cuenta
                </Link>
                <Button
                  asChild
                  className="mt-3 rounded-full bg-gradient-to-b from-munay-terracota to-munay-terracota-quemado text-white"
                >
                  <Link href={ROUTES.miCuenta}>Publicar prenda</Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
