/**
 * Aislamiento del bug de concurrencia del driver Neon (auditoría).
 *
 * Prueba DOS paths contra la BD real:
 *   A) `neon()` HTTP (usado por query/queryOne — el singleton)
 *   B) `Pool` (usado por transaction — WebSocket/WASM)
 *
 * Con N requests concurrentes de `SELECT 1` a cada uno, reporta cuál falla
 * y con qué error. Uso: node scripts/isolate-neon-driver.mjs [concurrency]
 */
import { neon, Pool } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

// Cargar .env.local manualmente (dotenv no está instalado en prod deps)
const env = readFileSync('.env.local', 'utf8')
const m = env.match(/^DATABASE_URL="?([^"\r\n]+)"?/m)
const connectionString = m?.[1] ?? process.env.DATABASE_URL
if (!connectionString) {
  console.error('No DATABASE_URL')
  process.exit(1)
}

const CONCURRENCY = Number(process.argv[2] ?? 20)

async function hammer(name, makeClient) {
  const client = makeClient()
  const results = []
  const run = async () => {
    const t0 = performance.now()
    try {
      const rows = await client.query('SELECT 1 AS one')
      results.push({ ok: true, ms: performance.now() - t0, rows: rows.length })
    } catch (err) {
      results.push({ ok: false, ms: performance.now() - t0, err: String(err?.message ?? err) })
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, run))
  const ok = results.filter((r) => r.ok)
  const bad = results.filter((r) => !r.ok)
  console.log(`\n=== ${name} (${CONCURRENCY} concurrentes) ===`)
  console.log(`  ok=${ok.length} fail=${bad.length}`)
  if (bad.length) {
    const errs = {}
    for (const b of bad) {
      const k = b.err.slice(0, 120)
      errs[k] = (errs[k] ?? 0) + 1
    }
    for (const [k, v] of Object.entries(errs)) {
      console.log(`  ✗ [${v}x] ${k}`)
    }
  }
}

const sql = neon(connectionString)
await hammer('A) neon() HTTP singleton — query()', () => ({
  query: (t, p) => sql.query(t, p ?? []),
}))
const pool = new Pool({ connectionString })
await hammer('B) Pool (WebSocket) — transaction path', () => ({
  query: (t, p) => pool.query(t, p ?? []).then((r) => r.rows),
}))
await pool.end()
