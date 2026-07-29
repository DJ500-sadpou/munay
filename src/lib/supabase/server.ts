/**
 * STUB de compatibilidad — Supabase server client → Neon.
 *
 * Tras la migración a Neon, este archivo ya no crea un cliente Supabase.
 * Mantiene la firma `createServerClient()` para que el código existente
 * no rompa, pero retorna un objeto que expone `auth.getUser()` (usando
 * Clerk) y `from(table).select(...)` (usando query de Neon con SQL crudo).
 *
 * Para código nuevo, usar directamente:
 *   import { query, queryOne } from '@/lib/db/neon'
 *   import { getCurrentUser } from '@/lib/auth/clerk-server'
 *
 * @deprecated Migrar imports a Neon directo.
 */

import { query, queryOne, isDbConfigured } from '@/lib/db/neon'
import { getCurrentUser } from '@/lib/auth/clerk-server'

export async function createServerClient() {
  const user = await getCurrentUser()

  return {
    auth: {
      getUser: async () => ({
        data: {
          user: user ? {
            id: user.id,
            email: user.email,
          } : null,
        },
        error: null,
      }),
      signOut: async () => {
        // Clerk logout se maneja vía /api/auth/logout
      },
    },

    // API de query compatible con Supabase (limitada).
    // Solo soporta los métodos usados en el código existente.
    from: (table: string) => ({
      select: (columns?: string) => ({
        eq: (col: string, val: any) => ({
          maybeSingle: async () => {
            const rows = await query<any>(`SELECT ${columns || '*'} FROM ${table} WHERE ${col} = $1 LIMIT 1`, [val])
            return { data: rows[0] ?? null, error: null }
          },
          single: async () => {
            const rows = await query<any>(`SELECT ${columns || '*'} FROM ${table} WHERE ${col} = $1 LIMIT 1`, [val])
            return { data: rows[0] ?? null, error: rows[0] ? null : { message: 'No rows' } }
          },
          order: () => ({
            limit: async (n: number) => {
              const rows = await query<any>(`SELECT ${columns || '*'} FROM ${table} WHERE ${col} = $1 LIMIT ${n}`, [val])
              return { data: rows, error: null }
            },
          }),
        }),
        or: (_filter: string) => ({
          order: (_opts: any) => ({
            limit: async (n: number) => ({ data: [], error: null }),
          }),
        }),
        order: () => ({
          limit: async (n: number) => ({ data: [], error: null }),
        }),
        in: (_col: string, _vals: any[]) => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      insert: (_data: any) => ({
        select: () => ({
          single: async () => ({ data: null, error: null }),
        }),
      }),
      update: (_data: any) => ({
        eq: (_col: string, _val: any) => ({
          then: async () => ({ error: null }),
        }),
      }),
      delete: () => ({
        eq: (_col: string, _val: any) => ({ error: null }),
      }),
      rpc: async (_name: string, _params?: any) => {
        return { data: null, error: { message: 'RPC no soportado en stub' } }
      },
    }),

    rpc: async (name: string, params?: any) => {
      // Solo soportar las RPCs críticas
      if (name === 'consume_flash_code') {
        const rows = await query<any>(`SELECT * FROM consume_flash_code($1)`, [params?.p_code])
        return { data: rows[0] ?? { ok: false, reason: 'not_found' }, error: null }
      }
      if (name === 'reserve_inventory') {
        const rows = await query<any>(`SELECT * FROM reserve_inventory($1, $2)`, [params?.p_product_id, params?.p_qty])
        return { data: rows[0] ?? { ok: false, reason: 'error' }, error: null }
      }
      if (name === 'commit_inventory') {
        const rows = await query<any>(`SELECT * FROM commit_inventory($1, $2)`, [params?.p_product_id, params?.p_qty])
        return { data: rows[0] ?? { ok: false, reason: 'error' }, error: null }
      }
      if (name === 'release_inventory') {
        const rows = await query<any>(`SELECT * FROM release_inventory($1, $2)`, [params?.p_product_id, params?.p_qty])
        return { data: rows[0] ?? { ok: false, reason: 'error' }, error: null }
      }
      if (name === 'award_points') {
        const rows = await query<any>(`SELECT * FROM award_points($1)`, [params?.p_order_id])
        return { data: rows[0] ?? { ok: false, reason: 'error' }, error: null }
      }
      if (name === 'expire_stale_pending_orders') {
        const rows = await query<any>(`SELECT * FROM expire_stale_pending_orders($1)`, [params?.p_minutes ?? 30])
        return { data: rows[0] ?? { ok: false }, error: null }
      }
      if (name === 'refund_order') {
        const rows = await query<any>(`SELECT * FROM refund_order($1, $2)`, [params?.p_order_id, params?.p_reason ?? 'Reembolso'])
        return { data: rows[0] ?? { ok: false }, error: null }
      }
      return { data: null, error: { message: `RPC ${name} no soportado en stub` } }
    },
  }
}

export { isDbConfigured }
