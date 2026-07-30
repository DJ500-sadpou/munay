/**
 * Tipos TypeScript que reflejan el esquema SQL de Supabase.
 * Estos tipos se usan con `supabase.from<T>('table')` para autocompletado.
 *
 * Mantener sincronizado con /supabase/migrations/*.sql
 */

export type Currency = 'USD' | 'EUR'

export type ProductCondition = 'new' | 'used'

export type ProductGrading = 'excelente' | 'buena' | 'regular'

export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'

export type PaymentProvider = 'kushki' | 'payphone' | 'paypal' | 'manual'

export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded'

export type FlashCodeType = 'discount' | 'unlock'

export type PointTxType = 'earn' | 'redeem' | 'adjust'

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          slug: string
          title: string
          description: string | null
          price_cents: number
          currency: Currency
          condition: ProductCondition
          grading: ProductGrading | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          description?: string | null
          price_cents: number
          currency?: Currency
          condition: ProductCondition
          grading?: ProductGrading | null
          active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      product_images: {
        Row: {
          id: string
          product_id: string
          url: string
          public_id: string | null
          sort: number
        }
        Insert: {
          id?: string
          product_id: string
          url: string
          public_id?: string | null
          sort?: number
        }
        Update: Partial<Database['public']['Tables']['product_images']['Insert']>
      }
      inventory: {
        Row: {
          product_id: string
          stock: number
          reserved: number
        }
        Insert: {
          product_id: string
          stock: number
          reserved?: number
        }
        Update: Partial<Database['public']['Tables']['inventory']['Insert']>
      }
      flash_codes: {
        Row: {
          code: string
          type: FlashCodeType
          discount_percent: number | null
          discount_cents: number | null
          starts_at: string
          ends_at: string
          max_uses: number | null
          uses_count: number
          active: boolean
        }
        Insert: {
          code: string
          type: FlashCodeType
          discount_percent?: number | null
          discount_cents?: number | null
          starts_at: string
          ends_at: string
          max_uses?: number | null
          uses_count?: number
          active?: boolean
        }
        Update: Partial<Database['public']['Tables']['flash_codes']['Insert']>
      }
      flash_code_products: {
        Row: {
          code: string
          product_id: string
        }
        Insert: {
          code: string
          product_id: string
        }
        Update: Partial<Database['public']['Tables']['flash_code_products']['Insert']>
      }
      orders: {
        Row: {
          id: string
          user_id: string | null
          customer_email: string
          status: OrderStatus
          subtotal_cents: number
          discount_cents: number
          points_redeemed: number
          total_cents: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          customer_email: string
          status?: OrderStatus
          subtotal_cents: number
          discount_cents?: number
          points_redeemed?: number
          total_cents: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          qty: number
          unit_price_cents: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          qty: number
          unit_price_cents: number
        }
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>
      }
      payments: {
        Row: {
          id: string
          order_id: string
          provider: PaymentProvider
          provider_ref: string | null
          status: PaymentStatus
          raw: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          provider: PaymentProvider
          provider_ref?: string | null
          status?: PaymentStatus
          raw?: Record<string, unknown> | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
      }
      customers: {
        Row: {
          id: string
          user_id: string | null
          email: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          email: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      point_transactions: {
        Row: {
          id: string
          customer_id: string
          order_id: string | null
          type: PointTxType
          points: number
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          order_id?: string | null
          type: PointTxType
          points: number
          note?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['point_transactions']['Insert']>
      }
      admins: {
        Row: {
          id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['admins']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      currency: Currency
      product_condition: ProductCondition
      product_grading: ProductGrading
      order_status: OrderStatus
      payment_provider: PaymentProvider
      payment_status: PaymentStatus
      flash_code_type: FlashCodeType
      point_tx_type: PointTxType
    }
  }
}
