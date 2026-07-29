'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { User, LogOut, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROUTES } from '@/lib/constants'

interface UserInfo {
  email: string
  balance: number
}

export function UserMenu() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user/points')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.ok) setUser({ email: data.email, balance: data.balance ?? 0 })
      })
      .catch(() => {/* not logged in */})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
  }

  if (!user) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href="/cuenta/login">
          <User className="h-4 w-4" aria-hidden />
          <span className="sr-only sm:not-sr-only sm:ml-1">Ingresar</span>
        </Link>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {user.email[0]?.toUpperCase()}
          </span>
          <span className="hidden sm:inline text-xs text-muted-foreground">
            {user.balance} pts
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-xs text-muted-foreground">Conectado como</p>
          <p className="text-sm font-medium truncate">{user.email}</p>
          <Badge variant="secondary" className="mt-2">
            <Sparkles className="mr-1 h-3 w-3" aria-hidden />
            {user.balance} pts
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/cuenta">
            <User className="mr-2 h-4 w-4" aria-hidden />
            Mi cuenta
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/cuenta/ordenes">
            <User className="mr-2 h-4 w-4" aria-hidden />
            Mis órdenes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/cuenta/puntos">
            <Sparkles className="mr-2 h-4 w-4" aria-hidden />
            Mis puntos
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action="/api/auth/logout?next=/" method="POST" className="w-full">
            <button type="submit" className="flex w-full items-center text-destructive">
              <LogOut className="mr-2 h-4 w-4" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
