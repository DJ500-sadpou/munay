/**
 * STUB de compatibilidad — Supabase admin client → Neon.
 *
 * Tras la migración a Neon, este archivo retorna un cliente que
 * internamente usa la misma conexión Neon. Como Neon no tiene RLS,
 * no hay distinción entre "admin" y "server" — ambos usan el mismo
 * pool con las mismas credenciales.
 *
 * @deprecated Usar `import { query } from '@/lib/db/neon'` directamente.
 */

import { query, queryOne, isDbConfigured } from '@/lib/db/neon'
import { getCurrentUser } from '@/lib/auth/clerk-server'

export function createAdminClient() {
  return {
    auth: {
      getUser: async () => {
        const user = await getCurrentUser()
        return { data: { user: user ? { id: user.id, email: user.email } : null }, error: null }
      },
    },

    from: (table: string) => ({
      select: (columns?: string) => ({
        eq: (col: string, val: any) => ({
          maybeSingle: async () => {
            const rows = await query<any>(`SELECT ${columns || '*'} FROM ${table} WHERE ${col} = $1 LIMIT 1`, [val])
            return { data: rows[0] ?? null, error: null }
          },
          single: async () => {
            const rows = await query<any>(`SELECT ${columns || '*'} FROM ${table} WHERE ${col} = $1 LIMIT 1`, [val])
            return { data: rows[0] ?? null, error: null }
          },
          order: () => ({
            limit: async (n: number) => {
              const rows = await query<any>(`SELECT ${columns || '*'} FROM ${table} WHERE ${col} = $1 LIMIT ${n}`, [val])
              return { data: rows, error: null }
            },
          }),
        }),
        or: (_filter: string) => ({
          order: () => ({
            limit: async (n: number) => ({ data: [], error: null }),
          }),
        }),
        order: () => ({
          limit: async (n: number) => ({ data: [], error: null }),
        }),
        in: (col: string, vals: any[]) => ({
          maybeSingle: async () => {
            if (vals.length === 0) return { data: null, error: null }
            const placeholders = vals.map((_, i) => `$${i + 1}`).join(',')
            const rows = await query<any>(`SELECT ${columns || '*'} FROM ${table} WHERE ${col} IN (${placeholders})`, vals)
            return { data: rows[0] ?? null, error: null }
          },
        }),
      }),
      insert: (data: any | any[]) => ({
        select: (cols?: string) => ({
          single: async () => {
            const arr = Array.isArray(data) ? data : [data]
            // Solo soporta inserts simples
            const first = arr[0]
            const cols = Object.keys(first)
            const values = cols.map((c) => first[c])
            const placeholders = cols.map((_, i) => `$${i + 1}`).join(',')
            const rows = await query<any>(
              `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders}) RETURNING ${cols || '*'}`
              , values
            )
            return { data: rows[0] ?? null, error: null }
          },
        }),
      }),
      update: (data: any) => ({
        eq: (col: string, val: any) => ({
          then: async (resolve: any) => {
            const sets = Object.keys(data).map((k, i) => `${k} = $${i + 1}`).join(',')
            const values = [...Object.values(data), val]
            await query(`UPDATE ${table} SET ${sets} WHERE ${col} = $${values.length}`, values)
            resolve?.({ error: null })
            return { error: null }
          },
        }),
      }),
      upsert: (data: any, _opts?: any) => ({
        then: async (resolve: any) => {
          resolve?.({ error: null })
          return { error: null }
        },
      }),
      delete: () => ({
        eq: (col: string, val: any) => ({
          then: async (resolve: any) => {
            await query(`DELETE FROM ${table} WHERE ${col} = $1`, [val])
            resolve?.({ error: null })
            return { error: null }
          },
        }),
      }),
    }),

    rpc: async (name: string, params?: any) => {
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
      return { data: null, error: { message: `RPC ${name} no soportado` } }
    },
  }
}

export { isDbConfigured }
