'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/lib/constants'
import { MunayPageShell } from '@/components/munay/page-shell'

export default function FlashCodeEntryPage() {
  const router = useRouter()
  const [code, setCode] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean.length < 4) return
    router.push(ROUTES.flash(clean))
  }

  return (
    <MunayPageShell size="sm" className="py-16">
      <div className="text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-munay-terracota/10 text-munay-terracota">
          <Zap className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-munay-ink">
          Ofertas flash
        </h1>
        <p className="mt-2 text-munay-ink/60">
          ¿Tienes un código secreto? Ingrésalo para desbloquear ofertas y prendas exclusivas.
        </p>
      </div>

      <Card className="border-black/5 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Ingresar código</CardTitle>
          <CardDescription>
            Mayúsculas y minúsculas no importan. Ejemplo: <code className="rounded bg-muted px-1.5 py-0.5">MUNAY10</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código flash</Label>
              <Input
                id="code"
                type="text"
                placeholder="MUNAY10"
                className="uppercase font-mono tracking-widest"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                required
                minLength={4}
                maxLength={32}
              />
            </div>
            <Button type="submit" size="lg" className="w-full bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
              Desbloquear
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Button>
          </form>
        </CardContent>
      </Card>
    </MunayPageShell>
  )
}
