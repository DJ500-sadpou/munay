'use client'

import { useState } from 'react'
import { ShoppingBag, Users, ToggleLeft, ToggleRight, Clock, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { WeekBuyCampaign } from '@/types/week-buy'

interface Props {
  initialCampaigns: WeekBuyCampaign[]
}

export function WeekBuyCampaignsList({ initialCampaigns }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [toggling, setToggling] = useState<string | null>(null)

  const activeCampaign = campaigns.find((c) => c.active && c.seconds_remaining !== null && c.seconds_remaining > 0)

  const handleToggle = async (id: string, current: boolean) => {
    setToggling(id)
    try {
      const res = await fetch('/api/admin/week-buy/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: !current }),
      })
      if (res.ok) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === id ? { ...c, active: !current } : c))
        )
      }
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="space-y-4">
      {activeCampaign && (
        <Card className="border-munay-terracota/20 bg-munay-terracota/[0.03]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-munay-terracota">
              <ShoppingBag className="h-4 w-4" aria-hidden />
              Activa ahora
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-munay-ink/70">
            <p className="font-medium text-munay-ink">{activeCampaign.title}</p>
            <p className="mt-1 text-xs">
              {activeCampaign.commitments_count}/{activeCampaign.min_commitments} compromisos ·{' '}
              {activeCampaign.discount_percent}% descuento
            </p>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-munay-ink/60">
        {campaigns.length} {campaigns.length === 1 ? 'campaña' : 'campañas'} registradas
      </p>

      {campaigns.length === 0 ? (
        <Card className="border-dashed border-black/10">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShoppingBag className="h-10 w-10 text-munay-ink/30" aria-hidden />
            <p className="text-munay-ink/60">Aún no hay campañas de la Quincena Munay.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {campaigns.map((campaign) => {
            const isActive = campaign.active && campaign.seconds_remaining !== null && campaign.seconds_remaining > 0
            const hasEnded = campaign.seconds_remaining !== null && campaign.seconds_remaining <= 0
            const statusLabel = campaign.active
              ? hasEnded ? 'Terminada' : isActive ? 'Activa' : 'Programada'
              : 'Inactiva'
            const statusVariant: 'default' | 'secondary' | 'outline' = campaign.active
              ? isActive ? 'default' : 'secondary'
              : 'outline'

            return (
              <Card key={campaign.id} className="overflow-hidden">
                <CardHeader className={`pb-2 ${isActive ? 'bg-munay-terracota/5' : ''}`}>
                  <CardTitle className="flex items-center justify-between text-sm font-semibold">
                    <span className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-munay-cacao" aria-hidden />
                      {campaign.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                      {isActive && (
                        <button
                          onClick={() => handleToggle(campaign.id, campaign.active)}
                          disabled={toggling === campaign.id}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-munay-ink/40 hover:bg-black/5 hover:text-munay-ink transition-colors"
                          aria-label={campaign.active ? 'Desactivar campaña' : 'Activar campaña'}
                        >
                          <ToggleRight className="h-5 w-5 text-munay-terracota" aria-hidden />
                        </button>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-munay-ink/60">
                  <p><span className="font-medium text-munay-ink">{campaign.category}</span> · {campaign.discount_percent}% descuento</p>
                  <p>{campaign.description ?? 'Sin descripción'}</p>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" aria-hidden />
                      {new Date(campaign.close_at).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden />
                      {campaign.seconds_remaining !== null
                        ? `${Math.floor(campaign.seconds_remaining / 3600)}h restantes`
                        : '—'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" aria-hidden />
                      {campaign.commitments_count}/{campaign.min_commitments}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
