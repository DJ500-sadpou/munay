'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageCircle, Loader2, CheckCircle2, XCircle, Clock, Search, ExternalLink, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/format'


type TicketStatus = 'new' | 'in_progress' | 'completed' | 'cancelled'
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
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: any }> = {
  new: { label: 'Nuevo', variant: 'default', icon: Clock },
  in_progress: { label: 'En progreso', variant: 'secondary', icon: Loader2 },
  completed: { label: 'Completado', variant: 'outline', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', variant: 'destructive', icon: XCircle },
}

const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  new: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [changingStatus, setChangingStatus] = useState<string | null>(null)

  const [loadError, setLoadError] = useState<string | null>(null)

  const loadTickets = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/tickets')
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`)
      }
      const data = await res.json()
      if (data?.ok) {
        setTickets(data.tickets)
      } else {
        throw new Error(data.error ?? 'Error desconocido')
      }
    } catch (err: any) {
      setLoadError(err?.message ?? 'Error de conexión al cargar tickets')
      console.error('[admin/tickets] Error loading:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  const changeStatus = async (ticketId: string, newStatus: TicketStatus) => {
    setChangingStatus(ticketId)
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.ok) {
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
        )
      }
    } catch {
      // Ignorar
    } finally {
      setChangingStatus(null)
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
        (t.order_id && t.order_id.toLowerCase().includes(q))
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

      {/* Filtros */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'new', 'in_progress', 'completed', 'cancelled'] as const).map((f) => (
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
            placeholder="Buscar por nombre, email o ID..."
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
            <Button variant="outline" size="sm" onClick={loadTickets}>
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
                      <span className="font-medium text-munay-ink truncate">{ticket.name}</span>
                      {statusBadge(ticket.status)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-munay-ink/60">
                      <span>{ticket.email}</span>
                      {ticket.phone && <span>{ticket.phone}</span>}
                      <span>{formatDate(ticket.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</span>
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
                            <div key={i} className="flex justify-between gap-2">
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
