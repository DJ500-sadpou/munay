'use client'

import { Zap, Search, XCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/**
 * [F2.3] Modal "¿Qué es un código flash?" dentro del catálogo.
 *
 * Reutiliza el botón existente "Tengo un código flash" (antes enlazaba a
 * /flash) como trigger del Dialog. Contenido: qué es un código flash, dónde
 * escribirlo (señalando la barra de búsqueda) y ejemplo de un resultado
 * válido aplicado.
 */
export function FlashHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="sm:w-auto">
          <Zap className="mr-2 h-4 w-4" aria-hidden />
          Tengo un código flash
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-munay-ink">
            <Zap className="h-5 w-5 text-munay-terracota" aria-hidden />
            ¿Qué es un código flash?
          </DialogTitle>
          <DialogDescription>
            Un código flash desbloquea piezas exclusivas que no están visibles
            en el catálogo público.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm text-munay-ink/70">
          <div className="rounded-lg border border-black/5 bg-white p-3">
            <p className="flex items-center gap-2 font-medium text-munay-ink">
              <Search className="h-4 w-4 text-munay-terracota" aria-hidden />
              Dónde escribirlo
            </p>
            <p className="mt-1.5">
              Escríbelo directamente en la{' '}
              <strong className="text-munay-ink">barra de búsqueda</strong> de
              arriba (la que dice{' '}
              <em className="not-italic text-munay-ink/60">
                "Buscar prendas o ingresar código flash…"
              </em>
              ) y presiona{' '}
              <span className="rounded bg-munay-crema/40 px-1 py-0.5 font-mono text-xs">
                Buscar
              </span>
              .
            </p>
          </div>

          <div className="rounded-lg border border-black/5 bg-white p-3">
            <p className="flex items-center gap-2 font-medium text-munay-ink">
              <CheckCircle2 className="h-4 w-4 text-munay-terracota" aria-hidden />
              Qué pasa si es válido
            </p>
            <p className="mt-1.5">
              El catálogo se filtra y verás{' '}
              <strong className="text-munay-ink">solo las piezas desbloqueadas</strong>{' '}
              con el badge <Zap className="inline h-3 w-3 text-munay-terracota" aria-hidden />{' '}
              <strong className="text-munay-ink">Código Flash aplicado</strong>.
              Si la pieza tiene precio especial, lo verás reflejado en la tarjeta.
            </p>
            <p className="mt-2 rounded-md bg-munay-crema/40 px-3 py-2 font-mono text-xs text-munay-ink/80">
              Ejemplo: <strong className="text-munay-terracota">MUNAY25</strong> →
              resultado válido aplicado ⚡
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-black/10 bg-munay-crema/20 p-3">
            <p className="flex items-center gap-2 font-medium text-munay-ink">
              <XCircle className="h-4 w-4 text-munay-ink/40" aria-hidden />
              Si no es válido
            </p>
            <p className="mt-1.5">
              Verás un aviso indicando que el código no existe, expiró o alcanzó
              su límite de usos, y la búsqueda normal continúa.
            </p>
          </div>

          <p className="text-xs text-munay-ink/50">
            Los códigos flash son distintos de los cupones de descuento. Los
            cupones se aplican en el checkout.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
