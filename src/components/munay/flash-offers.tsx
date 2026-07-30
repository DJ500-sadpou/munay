'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

const START_SECONDS = 2 * 3600 + 45 * 60 + 18 // 02:45:18

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

export function MunayFlashOffers() {
  const [seconds, setSeconds] = useState(START_SECONDS)

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => (s <= 0 ? START_SECONDS : s - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  return (
    <div className="relative flex h-full overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br from-munay-red-500 to-munay-red-800 shadow-sm">
      <div className="relative z-10 flex flex-col gap-4 p-6 sm:p-7">
        <h2 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-wide text-white">
          <Zap className="h-5 w-5 fill-white" aria-hidden />
          Ofertas Flash
        </h2>
        <p className="text-sm text-white/85">Descuentos que no duran nada</p>

        <div>
          <p
            className="font-mono text-4xl font-bold tabular-nums text-white sm:text-[42px]"
            aria-live="off"
          >
            {pad(h)} : {pad(m)} : {pad(s)}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
            Termina en
          </p>
        </div>

        <Button
          asChild
          className="mt-2 w-fit rounded-xl bg-white px-5 font-semibold text-munay-red-600 hover:bg-white/90"
        >
          <Link href="/flash">Ver todas las ofertas</Link>
        </Button>
      </div>

      <div className="pointer-events-none absolute bottom-0 right-0 top-0 hidden w-[46%] sm:block">
        <Image
          src="/munay/ref-flash-jacket.webp"
          alt="Chaqueta roja en oferta flash"
          fill
          sizes="(max-width: 1024px) 50vw, 25vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-munay-red-600 to-transparent" />
      </div>
    </div>
  )
}
