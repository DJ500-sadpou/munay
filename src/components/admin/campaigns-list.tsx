'use client'

import { useState } from 'react'
import { Zap, Sparkles, Plus, ToggleLeft, ToggleRight, Clock, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Campaign } from '@/types/campaign'

interface Props {
  initialCampaigns: Campaign[]
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  active: { label: 'Activa', variant: 'default' },
  pending: { label: 'Programada', variant: 'secondary' },
  ended: { label: 'Terminada', variant: 'outline' },
  inactive: { label: 'Inactiva', variant: 'outline' },
}

export function CampaignsList({ initialCampaigns }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [toggling, setToggling] = useState<string | null>(null)

  const handleToggle = async (id: string, current: boolean) => {
    setToggling(id)
    try {
      const res = await fetch('/api/admin/campaigns/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: id, active: !current }),
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-munay-ink/60">
          {campaigns.length} {campaigns.length === 1 ? 'campaña' : 'campañas'} registradas
        </p>
      </div>

      {campaigns.length === 0 ? (
        <Card className="border-dashed border-black/10">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Sparkles className="h-10 w-10 text-munay-ink/30" aria-hidden />
            <p className="text-munay-ink/60">Aún no hay campañas creadas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => {
            const statusInfo = STATUS_LABELS[campaign.status] ?? { label: campaign.status, variant: 'outline' }
            const isFlash = campaign.type === 'flash'

            return (
              <Card key={campaign.id} className="overflow-hidden">
                <CardHeader className={`pb-3 ${campaign.active && campaign.status === 'active' ? (isFlash ? 'bg-munay-terracota/5' : 'bg-munay-cacao/5') : ''}`}>
                  <CardTitle className="flex items-center justify-between text-sm font-semibold">
                    <span className="flex items-center gap-2">
                      {isFlash ? (
                        <Zap className="h-4 w-4 text-munay-terracota" aria-hidden />
                      ) : (
                        <Sparkles className="h-4 w-4 text-munay-cacao" aria-hidden />
                      )}
                      {campaign.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      {campaign.status === 'active' && (
                        <button
                          onClick={() => handleToggle(campaign.id, campaign.active)}
                          disabled={toggling === campaign.id}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-munay-ink/40 hover:text-munay-ink transition-colors rounded-md hover:bg-black/5"
                          aria-label={campaign.active ? 'Desactivar campaña' : 'Activar campaña'}
                        >
                          {campaign.active ? (
                            <ToggleRight className="h-5 w-5 text-munay-terracota" aria-hidden />
                          ) : (
                            <ToggleLeft className="h-5 w-5" aria-hidden />
                          )}
                        </button>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-munay-ink/60 space-y-2">
                  <p>{campaign.description ?? 'Sin descripción'}</p>
                  {campaign.categoria_tematica && (
                    <span className="inline-block rounded-md bg-munay-crema/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-munay-ink/50">
                      {campaign.categoria_tematica}
                    </span>
                  )}
                  <div className="flex items-center gap-4 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" aria-hidden />
                      {new Date(campaign.starts_at).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden />
                      {campaign.seconds_remaining !== null
                        ? `${Math.floor(campaign.seconds_remaining / 3600)}h restantes`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex gap-3 pt-1 font-medium text-munay-ink">
                    {campaign.discount_percent !== null && (
                      <span>{campaign.discount_percent}% desc.</span>
                    )}
                    <span>{campaign.product_count} productos</span>
                    <span>{campaign.uses_count} usos</span>
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
