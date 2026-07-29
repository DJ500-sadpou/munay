'use client'

import Link from 'next/link'
import { Sparkles, ShoppingBag, Menu } from 'lucide-react'
import { SITE, ROUTES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
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

const NAV_LINKS = [
  { href: ROUTES.home, label: 'Inicio' },
  { href: ROUTES.catalogo, label: 'Catálogo' },
  { href: '/flash', label: 'Ofertas flash' },
]

export function Navbar() {
  const mounted = useMounted()
  const totalItems = useCart((s) => s.lines.reduce((sum, l) => sum + l.qty, 0))

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href={ROUTES.home} className="flex items-center gap-2 group">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            {SITE.name}
          </span>
        </Link>

        {/* Nav desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <Button key={l.href} asChild variant="ghost" size="sm">
              <Link href={l.href}>{l.label}</Link>
            </Button>
          ))}
        </nav>

        {/* CTA + mobile menu */}
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="relative">
            <Link href={ROUTES.carrito} aria-label="Carrito">
              <ShoppingBag className="h-5 w-5" aria-hidden />
              {mounted && totalItems > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>
          </Button>

          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href={ROUTES.checkout}>Checkout</Link>
          </Button>

          <UserMenu />

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader>
                <SheetTitle className="text-left">{SITE.name}</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1 px-4">
                {NAV_LINKS.map((l) => (
                  <Button key={l.href} asChild variant="ghost" className="justify-start">
                    <Link href={l.href}>{l.label}</Link>
                  </Button>
                ))}
                <Button asChild variant="ghost" className="justify-start">
                  <Link href={ROUTES.carrito}>
                    Carrito
                    {mounted && totalItems > 0 && (
                      <span className="ml-2 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {totalItems}
                      </span>
                    )}
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="justify-start">
                  <Link href={ROUTES.checkout}>Checkout</Link>
                </Button>
                <Button asChild variant="ghost" className="justify-start">
                  <Link href="/cuenta">Mi cuenta</Link>
                </Button>
                <Button asChild variant="ghost" className="justify-start">
                  <Link href="/admin">Admin</Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
