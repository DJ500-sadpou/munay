'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Check,
  AlertCircle,
  Loader2,
  Ticket,
  Info,
  Sparkles,
  ShoppingBag,
  HelpCircle,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { formatCents, formatDate } from '@/lib/format'
import { ROUTES } from '@/lib/constants'
import { useCart } from '@/store/cart'
import type { Coupon } from '@/lib/queries/coupons'
// [FIX Ronda 5] El almacenamiento del "preferido" (JSON { code, at } con TTL
// de 1h, limpieza de obsoletos/corruptos/formato viejo) vive en
// src/lib/coupon-storage.ts, compartido con checkout para no duplicar la
// regla TTL en dos archivos (riesgo de drift silencioso).
import { readSelected, writeSelected } from '@/lib/coupon-storage'

/** [P2b] Keys de localStorage para "Mis cupones". */
const ADDED_KEY = 'munay.cupones.added'

interface Props {
  coupons: Coupon[]
  returnTo?: string
  dbError: boolean
}

/**
 * [FIX Ronda 1] Se guarda el CUPÓN COMPLETO (viene de data.coupon del
 * endpoint /api/coupons/apply) en localStorage, no solo el código: las cards
 * de agregados muestran % real, vigencia real y monto mínimo real.
 */
function readAdded(): Coupon[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(ADDED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    // [FIX Ronda 2] Type guard honesto: exige los campos que las cards usan
    // (codigo y porcentaje_descuento numérico); filtra el formato viejo
    // (strings) y objetos malformados que renderizarían "undefined% OFF".
    return Array.isArray(parsed)
      ? parsed.filter(
          (c): c is Coupon =>
            !!c &&
            typeof c.codigo === 'string' &&
            typeof c.porcentaje_descuento === 'number' &&
            typeof c.fecha_fin === 'string'
        )
      : []
  } catch {
    return []
  }
}

function writeAdded(coupons: Coupon[]) {
  try {
    window.localStorage.setItem(ADDED_KEY, JSON.stringify(coupons))
  } catch {
    /* localStorage no disponible (SSR/privacy mode) — no crítico */
  }
}

/**
 * [P2b] "Mis cupones" — cliente.
 *
 * Patrón PedidosYa adaptado al sistema visual MUNAY (sin branding externo):
 * cards con % grande, código, monto mínimo, vigencia, estado y botón
 * "Usar cupón" + ícono de términos. Área para agregar/redimir un código.
 *
 * Handshake con checkout: al pulsar "Usar cupón" se navega a
 * `${returnTo}?coupon=CODE` (o `/checkout?coupon=CODE` si no vino desde un
 * returnTo). El checkout aplica el cupón leyendo el query param.
 *
 * [FIX Ronda 1] La grilla renderiza la UNIÓN (dedupe por código) de los
 * cupones del server + los agregados en localStorage — antes era una
 * partición y un cupón presente en ambos desaparecía de la grilla.
 */
export function CuponesClient({ coupons, returnTo, dbError }: Props) {
  const router = useRouter()
  const subtotalCents = useCart((s) => s.subtotalCents())

  // Cupones agregados localmente (cupón COMPLETO, no solo código)
  const [addedCoupons, setAddedCoupons] = useState<Coupon[]>([])
  const [selectedCode, setSelectedCode] = useState<string | null>(null)

  // Formulario "Agregar cupón"
  const [codeInput, setCodeInput] = useState('')
  const [addStatus, setAddStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [addError, setAddError] = useState('')

  // Términos del cupón seleccionado (modal)
  const [termsCoupon, setTermsCoupon] = useState<Coupon | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    // [FIX Lint] setState síncrono en body de effect (react-hooks/
    // set-state-in-effect) → se difiere la lectura de localStorage al
    // callback del timer (patrón aceptado: setState en callback async).
    const id = window.setTimeout(() => {
      setAddedCoupons(readAdded())
      setSelectedCode(readSelected())
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  const markAdded = (coupon: Coupon) => {
    setAddedCoupons((prev) => {
      const next = prev.some((c) => c.codigo === coupon.codigo)
        ? prev
        : [...prev, coupon]
      writeAdded(next)
      return next
    })
  }

  const handleAdd = async () => {
    const codigo = codeInput.trim().toUpperCase()
    if (codigo.length < 4 || codigo.length > 32) {
      setAddStatus('error')
      setAddError('El código debe tener entre 4 y 32 caracteres.')
      return
    }
    if (addedCoupons.some((c) => c.codigo === codigo)) {
      setAddStatus('error')
      setAddError(`El cupón ${codigo} ya está agregado a tus cupones.`)
      return
    }
    setAddStatus('loading')
    setAddError('')
    try {
      // [P2b] ignorar_minimo=true: al AGREGAR no debe rechazar por el subtotal
      // del carrito actual (que puede estar vacío). El monto mínimo se revalida
      // al aplicar en checkout. El código lo valida el servidor (activo,
      // vigencia, usos, primera_compra).
      const res = await fetch('/api/coupons/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          subtotal_cents: subtotalCents,
          customer_email: '',
          ignorar_minimo: true,
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        setAddStatus('error')
        setAddError(data.error ?? 'Cupón inválido.')
        return
      }
      // [FIX Ronda 1] Guardar el cupón COMPLETO devuelto por el endpoint
      // (data.coupon) para mostrar %/vigencia/monto mínimo reales.
      const full: Coupon | undefined = data.coupon
      if (full && typeof full.porcentaje_descuento === 'number') {
        markAdded(full)
      } else {
        // Fallback defensivo: cupón mínimo con el código (no debería pasar).
        markAdded({
          id: codigo,
          codigo,
          tipo: 'general',
          porcentaje_descuento: data.discount_percent ?? 0,
          monto_minimo_compra: 0,
          fecha_inicio: new Date().toISOString(),
          fecha_fin: new Date(Date.now() + 30 * 86400000).toISOString(),
          activo: true,
          usos_maximos: null,
          usos_actuales: 0,
          order_id: null,
          created_at: new Date().toISOString(),
        })
      }
      setAddStatus('success')
      setCodeInput('')
      setTimeout(() => setAddStatus('idle'), 2500)
    } catch {
      setAddStatus('error')
      setAddError('Error de conexión. Intenta nuevamente.')
    }
  }

  const handleUse = useCallback(
    (coupon: Coupon) => {
      // Guardar como preferido (estado "Aplicado" en la card)
      writeSelected(coupon.codigo)
      setSelectedCode(coupon.codigo)
      // Si vino desde checkout → volver aplicado; si no → ir a checkout con
      // el cupón (o al catálogo si el carrito está vacío).
      const target = returnTo ?? (subtotalCents > 0 ? ROUTES.checkout : ROUTES.catalogo)
      const sep = target.includes('?') ? '&' : '?'
      router.push(`${target}${sep}coupon=${encodeURIComponent(coupon.codigo)}`)
    },
    [returnTo, subtotalCents, router]
  )

  // [FIX Ronda 1] UNIÓN deduplicada por código: server + agregados localmente.
  const byCode = new Map<string, Coupon>()
  for (const c of coupons) byCode.set(c.codigo, c)
  for (const c of addedCoupons) if (!byCode.has(c.codigo)) byCode.set(c.codigo, c)
  const allCoupons = Array.from(byCode.values())
  const now = Date.now()
  // [FIX Ronda 2] El contador "disponibles" no debe incluir vencidos.
  const availableCount = allCoupons.filter((c) => new Date(c.fecha_fin).getTime() >= now).length

  // Vigencia legible: "Vence hoy a las 23:59" o "Vence el 15 de agosto"
  // [FIX Ronda 2] Timezone explícita America/Guayaquil (igual que formatDate)
  // para que la card y el modal de términos muestren la misma hora.
  const expiryLabel = (iso: string): string => {
    const d = new Date(iso)
    const today = new Date()
    const sameDay = d.toDateString() === today.toDateString()
    if (sameDay) {
      return `Vence hoy a las ${d.toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Guayaquil',
      })}`
    }
    return `Vence el ${d.toLocaleDateString('es-EC', {
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Guayaquil',
    })}`
  }

  const minLabel = (c: Coupon) =>
    c.monto_minimo_compra > 0
      ? `Compra mínima: ${formatCents(c.monto_minimo_compra)}`
      : 'Sin compra mínima'

  const isExpired = (c: Coupon) => new Date(c.fecha_fin).getTime() < now
  const isNearExpiry = (c: Coupon) => {
    const diff = new Date(c.fecha_fin).getTime() - now
    return diff > 0 && diff < 48 * 60 * 60 * 1000 // < 48h
  }

  if (dbError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-black/10 bg-white p-12 text-center">
        <AlertCircle className="h-10 w-10 text-munay-ink/30" aria-hidden />
        <p className="font-medium text-munay-ink">No pudimos cargar tus cupones.</p>
        <p className="text-sm text-munay-ink/60">Inténtalo nuevamente.</p>
        <Button asChild variant="outline" size="sm">
          <Link href={returnTo ?? ROUTES.cupones}>Reintentar</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Área "Agregar cupón" ─────────────────────────────── */}
      <Card className="border-black/5 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5 text-primary" aria-hidden />
            Agregar cupón
          </CardTitle>
          <CardDescription>
            ¿Tienes un código? Escríbelo aquí y lo guardamos en tus cupones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="MUNAY25"
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value.toUpperCase())
                if (addStatus === 'error' || addStatus === 'success') setAddStatus('idle')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleAdd()
                }
              }}
              disabled={addStatus === 'loading'}
              className="font-mono uppercase tracking-widest"
              aria-label="Código de cupón"
            />
            <Button
              type="button"
              onClick={() => void handleAdd()}
              disabled={addStatus === 'loading' || !codeInput.trim()}
              className="shrink-0 bg-munay-terracota text-white hover:bg-munay-terracota-quemado"
            >
              {addStatus === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : addStatus === 'success' ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                'Agregar'
              )}
            </Button>
          </div>

          {addStatus === 'error' && (
            <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
              <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
              {addError}
            </p>
          )}
          {addStatus === 'success' && (
            <p className="flex items-center gap-1.5 text-xs text-primary" role="status">
              <Check className="h-3 w-3 shrink-0" aria-hidden />
              Cupón agregado a tus cupones.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Lista "Tus cupones disponibles" ──────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-munay-ink/50">
            Tus cupones disponibles ({availableCount})
          </h2>
          {/* [FIX Ronda 2] aria-expanded/aria-controls para el toggle de ayuda */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-munay-ink/60"
            onClick={() => setHelpOpen((v) => !v)}
            aria-expanded={helpOpen}
            aria-controls="cupones-ayuda"
          >
            <HelpCircle className="mr-1 h-3.5 w-3.5" aria-hidden />
            ¿Cómo uso un cupón?
          </Button>
        </div>

        {allCoupons.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center">
            <Ticket className="h-10 w-10 text-munay-ink/30" aria-hidden />
            <p className="font-display text-lg font-semibold text-munay-ink">
              Aún no tienes cupones disponibles
            </p>
            <p className="max-w-sm text-sm text-munay-ink/60">
              Revisa nuestras campañas, participa en MUNAY Live o agrega un código.
            </p>
            <Button asChild className="mt-2 bg-munay-terracota text-white hover:bg-munay-terracota-quemado">
              <Link href={ROUTES.catalogo}>
                <ShoppingBag className="mr-2 h-4 w-4" aria-hidden />
                Explorar catálogo
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {allCoupons.map((c) => (
              <CouponCard
                key={c.codigo}
                coupon={c}
                selected={selectedCode === c.codigo}
                added={addedCoupons.some((a) => a.codigo === c.codigo)}
                expiryLabel={expiryLabel(c.fecha_fin)}
                minLabel={minLabel(c)}
                nearExpiry={isNearExpiry(c)}
                expired={isExpired(c)}
                onUse={() => handleUse(c)}
                onTerms={() => setTermsCoupon(c)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Ayuda "¿Cómo uso un cupón?" ──────────────────────── */}
      {helpOpen && (
        <Card id="cupones-ayuda" className="border-black/5 shadow-sm">
          <CardContent className="pt-6">
            <Accordion type="single" collapsible defaultValue="como-uso">
              <AccordionItem value="como-uso">
                <AccordionTrigger className="text-sm font-medium text-munay-ink">
                  ¿Cómo uso un cupón?
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm text-munay-ink/70">
                    <li>Agrega el cupón desde esta página o escríbelo en el checkout.</li>
                    <li>Agrega prendas al carrito.</li>
                    <li>Verifica que cumplas el monto mínimo.</li>
                    <li>En el checkout selecciona o aplica tu cupón.</li>
                    <li>
                      Munay aplicará automáticamente el descuento más conveniente si tienes un
                      Código Flash activo (los descuentos no son acumulables).
                    </li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* ── Modal de términos y condiciones ──────────────────── */}
      <Dialog open={!!termsCoupon} onOpenChange={(o) => !o && setTermsCoupon(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary" aria-hidden />
              Términos del cupón {termsCoupon?.codigo}
            </DialogTitle>
            <DialogDescription>
              Condiciones de uso de este cupón.
            </DialogDescription>
          </DialogHeader>

          {termsCoupon && (
            <div className="space-y-2 text-sm">
              <TermRow label="Código" value={<code className="font-mono font-bold text-munay-terracota">{termsCoupon.codigo}</code>} />
              <TermRow label="Descuento" value={`${termsCoupon.porcentaje_descuento}% OFF`} />
              <TermRow
                label="Tipo"
                value={
                  termsCoupon.tipo === 'primera_compra'
                    ? 'Primera compra (solo usuarios sin compras previas)'
                    : 'General (toda la tienda)'
                }
              />
              <TermRow label="Monto mínimo" value={minLabel(termsCoupon)} />
              <TermRow label="Vence" value={formatDate(termsCoupon.fecha_fin)} />
              {termsCoupon.usos_maximos != null && (
                <TermRow
                  label="Límite de usos"
                  value={`${termsCoupon.usos_actuales}/${termsCoupon.usos_maximos} usados`}
                />
              )}
              <div className="rounded-md border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-munay-ink/70">
                <Sparkles className="mr-1 inline h-3 w-3 text-primary" aria-hidden />
                Los descuentos no son acumulables. En caso de tener más de un
                descuento disponible, Munay aplicará automáticamente el
                descuento mayor.
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cerrar</Button>
            </DialogClose>
            {termsCoupon && (
              <Button
                className="bg-munay-terracota text-white hover:bg-munay-terracota-quemado"
                onClick={() => {
                  setTermsCoupon(null)
                  handleUse(termsCoupon)
                }}
              >
                Usar cupón
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TermRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-munay-ink">{value}</span>
    </div>
  )
}

function CouponCard({
  coupon,
  selected,
  added,
  expiryLabel,
  minLabel,
  nearExpiry,
  expired,
  onUse,
  onTerms,
}: {
  coupon: Coupon
  selected: boolean
  added: boolean
  expiryLabel: string
  minLabel: string
  nearExpiry: boolean
  expired: boolean
  onUse: () => void
  onTerms: () => void
}) {
  return (
    <div
      className={`relative flex flex-col rounded-xl border bg-white p-4 shadow-sm transition-shadow ${
        selected
          ? 'border-primary/40 ring-1 ring-primary/30'
          : expired
            ? 'border-black/10 opacity-60'
            : 'border-black/5 hover:shadow-md'
      }`}
    >
      {/* Badge estado */}
      {selected ? (
        <Badge className="absolute right-3 top-3 bg-primary text-white">Aplicado</Badge>
      ) : expired ? (
        <Badge variant="outline" className="absolute right-3 top-3 text-muted-foreground">
          Vencido
        </Badge>
      ) : nearExpiry ? (
        <Badge className="absolute right-3 top-3 bg-munay-terracota-quemado text-white">
          Próximo a vencer
        </Badge>
      ) : added ? (
        <Badge variant="secondary" className="absolute right-3 top-3">
          Agregado
        </Badge>
      ) : null}

      {coupon.tipo === 'primera_compra' && (
        <Badge className="mb-2 w-fit bg-munay-terracota/10 text-[10px] font-bold text-munay-terracota-quemado">
          Primera compra
        </Badge>
      )}

      <p className="font-mono text-sm font-bold tracking-tight text-munay-terracota">
        {coupon.codigo}
      </p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-munay-ink">
        {coupon.porcentaje_descuento}% OFF
      </p>
      <p className="mt-1 text-xs text-munay-ink/60">
        {coupon.tipo === 'primera_compra'
          ? 'Descuento exclusivo para tu primera compra'
          : 'Descuento general para toda la tienda'}
      </p>

      <div className="mt-3 space-y-1 text-xs text-munay-ink/70">
        <p>{minLabel}</p>
        <p className={nearExpiry && !expired ? 'font-semibold text-munay-terracota-quemado' : ''}>
          {expiryLabel}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          size="sm"
          className="flex-1 bg-munay-terracota text-white hover:bg-munay-terracota-quemado"
          onClick={onUse}
          disabled={expired}
        >
          Usar cupón
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={onTerms}
          aria-label={`Ver términos del cupón ${coupon.codigo}`}
        >
          <Info className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
