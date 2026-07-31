'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ROUTES } from '@/lib/constants'
import { LISTING_CONDITIONS, LISTING_CATEGORIES, LISTING_SIZES } from '@/types/user-listing'
import { submitListing } from './actions'

export default function PublicarPage() {
  const [state, formAction, isPending] = useActionState(submitListing, null)

  if (state?.ok) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-munay-turquesa/10">
            <Package className="h-8 w-8 text-munay-turquesa" aria-hidden />
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold text-munay-ink">
          ¡Prenda publicada!
        </h1>
        <p className="mt-2 text-munay-ink/60">
          Tu publicación está pendiente de verificación. Te notificaremos cuando esté activa.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button asChild variant="outline">
            <Link href={ROUTES.miCuenta}>Ir a mi cuenta</Link>
          </Button>
          <Button asChild>
            <Link href="/publicar">Publicar otra</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href={ROUTES.miCuenta}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Volver
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink">
          Publicar prenda
        </h1>
        <p className="mt-2 text-munay-ink/60">
          Publica tu ropa nueva o de segunda mano. Un administrador la verificará antes de que aparezca en el marketplace.
        </p>
      </div>

      <Card className="border-black/5 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Detalles de la prenda</CardTitle>
          <CardDescription>
            Todos los campos marcados con * son obligatorios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-5">
            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                name="title"
                placeholder="Ej: Chaqueta vaquera Levis talla M"
                required
                minLength={3}
                maxLength={200}
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe el estado, detalles, materiales…"
                rows={3}
              />
            </div>

            {/* Categoría + Condición */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Categoría *</Label>
                <Select name="category" required>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {LISTING_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="condition">Estado *</Label>
                <Select name="condition" required>
                  <SelectTrigger id="condition">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(LISTING_CONDITIONS) as [string, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Precio + Talla */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">Precio (USD) *</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="25.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="size">Talla</Label>
                <Select name="size">
                  <SelectTrigger id="size">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {LISTING_SIZES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Marca */}
            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                name="brand"
                placeholder="Ej: Levis, Zara, Nike…"
              />
            </div>

            {/* Error */}
            {state?.error && (
              <div className="rounded-lg border border-munay-terracota-quemado/20 bg-munay-terracota-quemado/5 px-4 py-3 text-sm text-munay-terracota-quemado">
                {state.error}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-munay-terracota text-white hover:bg-munay-terracota-quemado"
            >
              {isPending ? 'Publicando…' : 'Publicar prenda'}
            </Button>

            <p className="text-center text-xs text-munay-ink/40">
              Al publicar, aceptas nuestros Términos y Condiciones.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
