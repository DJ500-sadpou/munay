'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Copy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LIVE_CODES } from '@/lib/munay-data'

export function MunayLiveCodes() {
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-wide text-munay-ink">
          Códigos en vivo
          <Badge className="rounded-full bg-munay-terracota/10 px-2 text-[10px] font-bold text-munay-terracota hover:bg-munay-terracota/15">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-munay-terracota-quemado" />
            LIVE
          </Badge>
        </h2>
        <Link
          href="/flash"
          className="flex items-center gap-1 text-xs font-semibold text-munay-terracota hover:text-munay-terracota-quemado"
        >
          Ver todos los códigos
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <p className="mt-1 text-sm text-munay-ink/60">Usá el código y obtené el descuento</p>

      <ul className="mt-5 grid flex-1 gap-3 sm:grid-cols-3">
        {LIVE_CODES.map((c) => (
          <li
            key={c.code}
            className="flex flex-col rounded-xl border border-black/5 bg-munay-crema/15 p-4 text-center"
          >
            <p className="font-mono text-sm font-bold tracking-tight text-munay-terracota">
              {c.code}
            </p>
            <p className="mt-2 text-xl font-extrabold text-munay-ink">{c.discount}</p>
            <p className="text-[11px] text-munay-ink/60">{c.note}</p>
            <p className="mt-3 text-[10px] uppercase tracking-wide text-munay-ink/45">
              Usos restantes {c.total - c.used} / {c.total}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copy(c.code)}
              aria-live="polite"
              className="mt-3 rounded-lg border-munay-terracota/40 bg-white text-xs font-semibold text-munay-terracota hover:bg-munay-terracota/5 hover:text-munay-terracota-quemado"
            >
              {copied === c.code ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  ¡Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  Copiar código
                </>
              )}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
