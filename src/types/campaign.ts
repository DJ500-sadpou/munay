/**
 * Tipos para el sistema de Campañas Flash / Week Sale (Módulo 2).
 */

export type CampaignType = 'flash' | 'week_sale'
export type CampaignStatus = 'pending' | 'active' | 'ended' | 'inactive'

export interface Campaign {
  id: string
  name: string
  type: CampaignType
  description: string | null
  starts_at: string
  ends_at: string
  discount_percent: number | null
  points_multiplier: number
  max_uses: number | null
  uses_count: number
  active: boolean
  product_count: number
  status: CampaignStatus
  seconds_remaining: number | null
  created_at: string
}
