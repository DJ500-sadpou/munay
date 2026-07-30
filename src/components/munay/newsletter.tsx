'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function MunayNewsletter() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)

  return (
    <section className="flex flex-col items-start justify-between gap-5 rounded-2xl border border-black/5 bg-munay-crema/20 px-6 py-7 shadow-sm sm:px-8 lg:flex-row lg:items-center">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-munay-terracota/25 bg-white">
          <Mail className="h-4 w-4 text-munay-terracota" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-bold text-munay-ink">
            Ofertas exclusivas en tu email
          </h2>
          <p className="mt-1 text-xs text-munay-ink/60">
            Suscribite y recibí promociones, códigos y novedades.
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setDone(true)
          setEmail('')
        }}
        className="flex w-full max-w-md items-center gap-3"
      >
        <label htmlFor="munay-newsletter" className="sr-only">
          Tu email
        </label>
        <Input
          id="munay-newsletter"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Tu email"
          className="h-11 rounded-xl border-black/10 bg-white focus-visible:ring-munay-terracota/40"
        />
        <Button
          type="submit"
          className="h-11 shrink-0 rounded-xl bg-gradient-to-b from-munay-terracota to-munay-terracota-quemado px-6 font-semibold text-white hover:opacity-95"
        >
          Suscribirme
        </Button>
      </form>

      <p aria-live="polite" className="sr-only">
        {done ? 'Suscripción registrada' : ''}
      </p>
      {done && (
        <p className="text-xs font-semibold text-munay-terracota lg:hidden">
          ¡Listo! Te vamos a escribir pronto.
        </p>
      )}
    </section>
  )
}
