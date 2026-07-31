/**
 * Barra de búsqueda del catálogo.
 *
 * Comportamiento inteligente:
 *   - Si el texto PARECE un código flash (ver `looksLikeFlashCode`)
 *     y el código existe en DB, redirige a /flash/[code].
 *   - Si no, hace búsqueda normal de productos en /catalogo?q=...
 *
 * La detección del código flash se hace en el SERVER para que sea 100%
 * confiable: el cliente solo envía `q`, y el server decide si redirigir
 * o mostrar resultados.
 *
 * Implementación:
 *   - El input tiene un `<form action="/catalogo" method="GET">`.
 *   - El server action `searchRedirect` recibe `q`, valida con Supabase
 *     y redirige al destino correcto.
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function CatalogSearch({ initialValue = '' }: { initialValue?: string }) {
  const router = useRouter()
  const [value, setValue] = useState(initialValue)
  const [pending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = value.trim()
    if (!clean) {
      router.push('/catalogo')
      return
    }
    // El server decide si es flash code o búsqueda normal
    startTransition(() => {
      router.push(`/catalogo?q=${encodeURIComponent(clean)}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Buscar prendas o ingresar código flash…"
          className="pl-10 pr-24"
          autoComplete="off"
          aria-label="Buscar en el catálogo"
        />
        <Button
          type="submit"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8"
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Buscar
            </>
          )}
        </Button>
      </div>
      <p className="mt-1.5 px-1 text-xs text-muted-foreground">
        Si ingresas un código flash válido, te llevamos directo a la pieza exclusiva.
      </p>
    </form>
  )
}
