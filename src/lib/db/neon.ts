/**
 * Adaptador de base de datos para Neon Postgres.
 *
 * Reemplaza a los clientes Supabase (server/admin).
 *
 * Neon no tiene RLS ni Auth integrado — toda la lógica de permisos
 * se mueve a este adaptador (server-side checks).
 *
 * Usamos @neondatabase/serverless con pool HTTP (compatible con Edge).
 * Para queries usamos SQL crudo con tags para evitar inyección.
 */

import { neon, Pool } from '@neondatabase/serverless'

// fetchConnectionCache es siempre true desde v1.x (deprecado).
// No es necesario configurarlo explícitamente.

let pool: Pool | null = null

function getPool(): Pool {
  if (pool) return pool
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'Falta DATABASE_URL. Crea un proyecto en neon.com, copia la connection string ' +
      'y pégala en .env.local como DATABASE_URL=postgresql://...'
    )
  }
  pool = new Pool({ connectionString })
  return pool
}

/**
 * Cliente SQL tag-tagged para queries seguras (anti-inyección).
 *
 * Uso:
 *   const sql = getSql()
 *   const rows = await sql`SELECT * FROM products WHERE id = ${productId}`
 *
 * Los valores interpolados se parametrizan automáticamente.
 */
export function getSql() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('Falta DATABASE_URL en variables de entorno.')
  }
  return neon(connectionString)
}

/**
 * Ejecuta una query y retorna filas tipadas.
 * Si la DB no está configurada, retorna array vacío.
 * Ante error de ejecución, lanza excepción (no la traga).
 * Callers deben usar try/catch o confiar en que el error se propague.
 */
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  if (!isDbConfigured()) return []
  // neon() v1 retorna SOLO función tagged-template.
  // Para raw SQL con placeholders ($1, $2, …), usar .query().
  const sql = getSql() as unknown as { query: (text: string, params?: any[]) => Promise<any[]> }
  const rows = await sql.query(text, params ?? [])
  return rows as T[]
}

/**
 * Ejecuta una query y retorna la primera fila (o null).
 * Si la DB no está configurada, retorna null.
 */
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  if (!isDbConfigured()) return null
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}

/**
 * Ejecuta múltiples statements en una transacción.
 *
 * Uso:
 *   await transaction(async (tx) => {
 *     await tx`INSERT INTO orders ...`
 *     await tx`INSERT INTO order_items ...`
 *   })
 */
export async function transaction<T = any>(
  fn: (tx: ReturnType<typeof getSql>) => Promise<T>
): Promise<T> {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn((async (strings: TemplateStringsArray, ...values: any[]) => {
      const sql = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''), '')
      const res = await client.query(sql, values)
      return res.rows
    }) as any)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Detecta si la DB está configurada (Neon Postgres).
 */
export function isDbConfigured(): boolean {
  const url = process.env.DATABASE_URL
  if (!url) return false
  // Detectar placeholders
  if (url.includes('YOUR-NEON') || url.includes('YOUR-DATABASE')) return false
  // Detectar SQLite legacy (migración anterior)
  if (url.startsWith('file:')) return false
  // Solo aceptar postgres:// o postgresql://
  if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) return false
  return true
}
