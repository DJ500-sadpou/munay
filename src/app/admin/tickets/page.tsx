'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageCircle, Loader2, CheckCircle2, XCircle, Clock, Search, ExternalLink, AlertCircle, Zap, Hash, DollarSign, Hourglass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { formatDate, formatCents } from '@/lib/format'


// [F3.5] Estados ampliados: soporte (new/in_progress/completed/cancelled)
// + pedido (pendiente/expirado/confirmado).
type TicketStatus = 'new' | 'in_progress' | 'completed' | 'cancelled' | 'pendiente' | 'expirado' | 'confirmado'
type Ticket = {
  id: string
  name: string
  email: string
  phone: string | null
  message: string
  status: TicketStatus
  order_id: string | null
  created_at: string
  items: any | null
  // [F3.5] Columnas de pedido (00023)
  ticket_numero: number | null
  precio_total_cents: number | null
  fecha_expiracion: string | null
  descuento_aplicado: any | null
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: any }> = {
  new: { label: 'Nuevo', variant: 'default', icon: Clock },
  in_progress: { label: 'En progreso', variant: 'secondary', icon: Loader2 },
  completed: { label: 'Completado', variant: 'outline', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', variant: 'destructive', icon: XCircle },
  // [F3.5] Estados de pedido — paleta terracota/crema, nunca munay-red.
  pendiente: { label: 'Pendiente', variant: 'default', icon: Hourglass },
  expirado: { label: 'Expirado', variant: 'outline', icon: XCircle },
  confirmado: { label: 'Confirmado', variant: 'secondary', icon: CheckCircle2 },
}

const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  new: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  // [F3.5] Pedido: pendiente → confirmado (marca la orden paid) o cancelado.
  pendiente: ['confirmado', 'cancelled'],
  expirado: [],
  confirmado: [],
}

// [F3.5] Filtros: 4 de soporte + 3 de pedido + 'all'.
// (TicketStatus | 'all')[] — 'all' NO es un estado, es el filtro "Todos".
const FILTERS: (TicketStatus | 'all')[] = ['all', 'new', 'in_progress', 'completed', 'cancelled', 'pendiente', 'expirado', 'confirmado']

// [AUDIT] Fetch único y compartido (effect inicial + botón Reintentar).
// Módulo-level y SIN setState: la regla react-hooks/set-state-in-effect no
// rastrea setState a través de useCallback, por eso la lógica de fetch vive
// aquí y los callers hacen su propio setState tras el await.
async function fetchTickets(): Promise<{ tickets: Ticket[]; auto_expire_tickets_enabled: boolean }> {
  const res = await fetch('/api/admin/tickets')
  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${res.statusText}`)
  }
  const data = await res.json()
  if (!data?.ok) {
    throw new Error(data.error ?? 'Error desconocido')
  }
  return {
    tickets: data.tickets,
    auto_expire_tickets_enabled: data.auto_expire_tickets_enabled,
  }
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [changingStatus, setChangingStatus] = useState<string | null>(null)

  const [loadError, setLoadError] = useState<string | null>(null)

  // [F3.5] Toggle de expiración automática de tickets (settings).
  const [autoExpireTickets, setAutoExpireTickets] = useState<boolean>(true)
  const [toggleSaving, setToggleSaving] = useState(false)

  // [AUDIT] Aplica los datos del GET al estado (compartido por effect y retry).
  const applyTicketsData = useCallback((data: { tickets: Ticket[]; auto_expire_tickets_enabled: boolean }) => {
    setTickets(data.tickets)
    // [F3.5] El GET también devuelve el toggle para reflejar el estado real.
    if (typeof data.auto_expire_tickets_enabled === 'boolean') {
      setAutoExpireTickets(data.auto_expire_tickets_enabled)
    }
  }, [])

  // Carga inicial: loading ya inicia en true y loadError en null; el fetch
  // se hace INLINE en el effect (IIFE + await) para que la regla
  // react-hooks/set-state-in-effect vea que todo setState ocurre tras un
  // await. Flag cancelled evita setState tras desmontar.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const data = await fetchTickets()
        if (cancelled) return
        applyTicketsData(data)
      } catch (err: any) {
        if (cancelled) return
        setLoadError(err?.message ?? 'Error de conexión al cargar tickets')
        console.error('[admin/tickets] Error loading:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [applyTicketsData])

  // [F3.5] PATCH a settings para el toggle (vía updateSetting en la API).
  const toggleAutoExpire = async (next: boolean) => {
    setToggleSaving(true)
    // Actualización optimista: el Switch se mueve de inmediato.
    setAutoExpireTickets(next)
    try {
      const res = await fetch('/api/admin/tickets/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_expire_tickets_enabled: next }),
      })
      const data = await res.json()
      if (!data.ok) {
        console.error('[admin/tickets] Error toggle:', data.error)
        setAutoExpireTickets(!next) // revertir visual
        toast({ title: 'Error', description: data.error ?? 'No se pudo cambiar la configuración', variant: 'destructive' })
      } else {
        toast({
          title: next ? 'Expiración automática activada' : 'Expiración automática desactivada',
          description: next
            ? 'Los tickets pendientes expirarán a las 72h vía cron.'
            : 'Los tickets pendientes ya no expirarán automáticamente.',
        })
      }
    } catch {
      setAutoExpireTickets(!next)
      toast({ title: 'Error', description: 'Error de conexión al cambiar la configuración', variant: 'destructive' })
    } finally {
      setToggleSaving(false)
    }
  }

  const changeStatus = async (ticketId: string, newStatus: TicketStatus) => {
    setChangingStatus(ticketId)
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      // [AUDIT] Manejar errores (incluidos 500 no-JSON) con feedback visible:
      // antes el catch traga el error y el admin no sabía que NO quedó pagada.
      let data: any
      try {
        data = await res.json()
      } catch {
        throw new Error(`Respuesta inválida del servidor (${res.status})`)
      }
      if (data.ok) {
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
        )
        toast({
          title: 'Ticket actualizado',
          description: `Estado: ${STATUS_CONFIG[newStatus].label}`,
        })
      } else {
        throw new Error(data.error ?? 'No se pudo actualizar el ticket')
      }
    } catch (err: any) {
      console.error('[admin/tickets] Error changeStatus:', err)
      toast({
        title: 'Error al actualizar',
        description: err?.message ?? 'Error de conexión',
        variant: 'destructive',
      })
    } finally {
      setChangingStatus(null)
    }
  }

  const retryLoad = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchTickets()
      applyTicketsData(data)
    } catch (err: any) {
      setLoadError(err?.message ?? 'Error de conexión al cargar tickets')
      console.error('[admin/tickets] Error loading:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredTickets = tickets.filter((t) => {
    if (filter !== 'all' && t.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.order_id && t.order_id.toLowerCase().includes(q)) ||
        // [F3.5] Buscar por número de ticket (#1234) — normalizar a lowercase
        // igual que el resto (consistencia de búsqueda).
        (t.ticket_numero != null && `#${String(t.ticket_numero).padStart(4, '0')}`.toLowerCase().includes(q))
      )
    }
    return true
  })

  const statusBadge = (status: TicketStatus) => {
    const config = STATUS_CONFIG[status]
    const Icon = config.icon
    return (
      <Badge variant={config.variant}>
        <Icon className="mr-1 h-3 w-3" aria-hidden />
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Volver al panel
        </Link>
      </Button>

      <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink mb-2">Tickets</h1>
      <p className="text-munay-ink/60 mb-8">
        Pedidos y consultas recibidas por WhatsApp y soporte.
      </p>

      {/* [F3.5] Toggle de expiración automática (settings → cron) */}
      <Card className="mb-6 border-munay-terracota/15 bg-munay-crema/10">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-munay-terracota" aria-hidden />
            <div>
              <Label htmlFor="auto-expire" className="font-medium text-munay-ink">
                Expiración automática de tickets
              </Label>
              <p className="text-xs text-munay-ink/60">
                Si está activo, los pedidos con ticket que no se confirmen en 72h se
                cancelan y liberan stock automáticamente (cron cada 15min).
              </p>
            </div>
          </div>
          <Switch
            id="auto-expire"
            checked={autoExpireTickets}
            disabled={toggleSaving}
            onCheckedChange={toggleAutoExpire}
          />
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Todos' : STATUS_CONFIG[f].label}
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email, ID o #ticket..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <Card className="border-dashed border-black/10">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : loadError ? (
        <Card className="border-dashed border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-10 w-10 text-destructive/60" aria-hidden />
            <p className="text-sm text-destructive/80">{loadError}</p>
            <Button variant="outline" size="sm" onClick={retryLoad}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : filteredTickets.length === 0 ? (
        <Card className="border-dashed border-black/10">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <MessageCircle className="h-10 w-10 text-munay-ink/30" aria-hidden />
            <p className="text-munay-ink/60">
              {tickets.length === 0
                ? 'Aún no hay tickets. Cuando alguien haga un pedido o envíe un mensaje, aparecerán aquí.'
                : 'Ningún ticket coincide con los filtros.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => (
            <Card key={ticket.id} className="border-black/5 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {/* [F3.5] Número de ticket de pedido (#1234 — LPAD 4) */}
                      {ticket.ticket_numero != null && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-munay-terracota/10 px-1.5 py-0.5 font-mono text-xs font-bold text-munay-terracota">
                          <Hash className="h-3 w-3" aria-hidden />
                          {String(ticket.ticket_numero).padStart(4, '0')}
                        </span>
                      )}
                      <span className="font-medium text-munay-ink truncate">{ticket.name}</span>
                      {statusBadge(ticket.status)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-munay-ink/60">
                      <span>{ticket.email}</span>
                      {ticket.phone && <span>{ticket.phone}</span>}
                      <span>{formatDate(ticket.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      {/* [F3.5] Total del pedido */}
                      {ticket.precio_total_cents != null && (
                        <span className="inline-flex items-center gap-1 font-medium text-munay-ink">
                          <DollarSign className="h-3 w-3 text-munay-terracota" aria-hidden />
                          {formatCents(ticket.precio_total_cents)}
                        </span>
                      )}
                      {/* [F3.5] Expiración */}
                      {ticket.fecha_expiracion && (
                        <span className="inline-flex items-center gap-1">
                          <Hourglass className="h-3 w-3 text-munay-ink/40" aria-hidden />
                          Expira: {formatDate(ticket.fecha_expiracion, { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-munay-ink/70 line-clamp-2">
                      {ticket.message}
                    </p>
                    {ticket.order_id && (
                      <Link
                        href={`/admin/orders/${ticket.order_id}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-munay-terracota hover:text-munay-terracota-quemado transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden />
                        Ver orden {ticket.order_id.slice(0, 8)}…
                      </Link>
                    )}
                  </div>

                  <div className="flex items-center gap-2 sm:flex-col">
                    {/* Acciones según estado */}
                    {STATUS_TRANSITIONS[ticket.status].map((nextStatus) => (
                      <Button
                        key={nextStatus}
                        size="sm"
                        variant="outline"
                        disabled={changingStatus === ticket.id}
                        onClick={() => changeStatus(ticket.id, nextStatus)}
                      >
                        {changingStatus === ticket.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : nextStatus === 'in_progress' ? (
                          'En progreso'
                        ) : nextStatus === 'completed' ? (
                          'Completar'
                        ) : nextStatus === 'confirmado' ? (
                          'Confirmar'
                        ) : (
                          'Cancelar'
                        )}
                      </Button>
                    ))}

                    {/* WhatsApp link */}
                    {ticket.phone && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-munay-whatsapp"
                        asChild
                      >
                        <a
                          href={`https://wa.me/${ticket.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${ticket.name}, sobre tu pedido en Munay...`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="h-3 w-3" aria-hidden />
                          <span className="ml-1 hidden sm:inline">WhatsApp</span>
                        </a>
                      </Button>
                    )}

                    {/* Detalles del pedido */}
                    {ticket.items && (
                      <details className="w-full text-xs text-munay-ink/60">
                        <summary className="cursor-pointer hover:text-munay-ink transition-colors">
                          Ver items
                        </summary>
                        <div className="mt-1 space-y-1 rounded bg-munay-crema/20 p-2">
                          {(ticket.items as any).items?.map((item: any, i: number) => (
                            // [AUDIT] key con product_id si existe, índice como fallback.
                            <div key={item?.product_id ?? i} className="flex justify-between gap-2">
                              <span className="truncate">{item.title ?? 'Producto'}</span>
                              <span className="shrink-0">×{item.qty}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 text-center text-xs text-munay-ink/40">
        {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} en total
      </div>
    </div>
  )
}
