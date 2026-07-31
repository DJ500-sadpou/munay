/**
 * Tipos para el sistema Week Buy — Compra Semanal por Categoría.
 */

export type WeekBuyProgress = 'collecting' | 'goal_reached'

export interface WeekBuyCampaign {
  id: string
  category: string
  title: string
  description: string | null
  close_at: string
  discount_percent: number
  min_commitments: number
  commitments_count: number
  active: boolean
  seconds_remaining: number | null
  progress_status: WeekBuyProgress
  progress_percent: number
  created_at: string
}

export interface WeekBuyCommitment {
  id: string
  campaign_id: string
  user_id: string
  email: string
  notified: boolean
  created_at: string
}
