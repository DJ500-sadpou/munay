/**
 * Stress audit — sobrecarga controlada del sistema.
 *
 * ⚠️  SEGURIDAD: este script dispara peticiones REALES contra el servidor
 * y los endpoints. Si el servidor tiene DATABASE_URL configurada (Neon),
 * `/api/checkout/whatsapp` ejecutará `createOrder` contra la BD real:
 * crea órdenes, tickets (+72h), reserva stock y podría enviar mensajes
 * de WhatsApp reales. Por defecto el script SE NIEGA a correr si detecta
 * una BD configurada — pasa STRESS_ALLOW_REAL_DB=1 SOLO contra una BD de
 * prueba/dev, NUNCA contra producción. Además usa IDs de producto fake
 * (que no existen) para no insertar nada.
 *
 * Ejecuta N peticiones concurrentes contra los endpoints críticos:
 *   1. POST /api/checkout/whatsapp  (flujo de compra → ticket → WhatsApp)
 *   2. POST /api/coupons/apply      (validación de cupones, rate limiter 10s)
 *   3. GET  /catalogo               (catálogo público)
 *   4. GET  /                       (home)
 *
 * Reporta: distribución de códigos de estado, latencias (avg/p95/p99),
 * errores 5xx, y cuántas peticiones fueron rechazadas por el rate limiter
 * (429) tanto con IP real (misma) como con IPs variadas (spoofing XFF).
 *
 * Uso: node scripts/stress-audit.mjs [concurrency] [total]
 */

// [FIX AUDIT] IDs de producto como UUID REAL v4 (la columna products.id es
// uuid). Antes usábamos 'stress-prod-1' / 'probe-0000' (no-UUID) → PostgreSQL
// lanzaba 22P02 'invalid input syntax for type uuid' → 500 genérico, y el
// stress parecía un bug de la app cuando era del script. Con UUID inexistente
// la app responde 422 product_not_found (comportamiento esperado).
const FAKE_UUID = '00000000-0000-0000-0000-000000000000'

// Guard anti-producción: si el servidor responde 503 'DB no configurada'
// desde un probe inicial, es seguro. Si la BD está configurada, exigir
// STRESS_ALLOW_REAL_DB=1 (explícito) antes de golpear el endpoint de compra.
const PROBE_BODY = {
  customer_name: 'Probe',
  customer_email: 'probe@munay.test',
  items: [{ product_id: FAKE_UUID, qty: 1, title: 'Probe' }],
}

async function probeDbState() {
  try {
    const res = await fetch(`${process.env.STRESS_BASE_URL ?? 'http://localhost:3000'}/api/checkout/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.254.254.254' },
      body: JSON.stringify(PROBE_BODY),
    })
    const text = await res.text()
    let body = null
    try { body = JSON.parse(text) } catch { /* noop */ }
    return { status: res.status, body }
  } catch (err) {
    return { status: 0, body: { error: String(err?.message ?? err) } }
  }
}

const dbProbe = await probeDbState()
const dbConfigured = dbProbe.status !== 503 && !String(dbProbe.body?.error ?? '').includes('DB no configurada')
if (dbConfigured && process.env.STRESS_ALLOW_REAL_DB !== '1') {
  console.error('\n⚠️  El servidor tiene DATABASE_URL configurada (BD real).')
  console.error('    Este script crearía órdenes/tickets reales en /api/checkout/whatsapp.')
  console.error('    Si es una BD de prueba, relanza con STRESS_ALLOW_REAL_DB=1.')
  console.error('    Abortando por seguridad.\n')
  process.exit(2)
}
if (dbConfigured) {
  console.log('ℹ️  BD detectada. STRESS_ALLOW_REAL_DB=1 — los requests usan IDs de producto')
  console.log('    inexistentes (no insertan órdenes), pero NO ejecutes contra producción.\n')
} else {
  console.log('ℹ️  Modo demo detectado (sin BD) — los endpoints de compra responderán 503/400.\n')
}

const BASE = process.env.STRESS_BASE_URL ?? 'http://localhost:3000'
const CONCURRENCY = Number(process.argv[2] ?? 30)
const TOTAL = Number(process.argv[3] ?? 120)

function randIp() {
  return `200.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
}

function nowMs() {
  return performance.now()
}

async function timedFetch(path, opts = {}, headers = {}) {
  const start = nowMs()
  let res
  try {
    res = await fetch(`${BASE}${path}`, { ...opts, headers })
  } catch (err) {
    return { path, error: String(err?.message ?? err), ms: nowMs() - start }
  }
  const text = await res.text()
  let body = null
  try { body = JSON.parse(text) } catch { /* noop */ }
  return { path, status: res.status, ms: nowMs() - start, body }
}

function makeCheckoutBody(overrides = {}) {
  return JSON.stringify({
    customer_name: 'Stress Tester',
    customer_email: 'stress@munay.test',
    phone: '+593999999999',
    address: 'Av. Stress 123',
    city: 'Ibarra',
    province: 'Imbabura',
    shipping_cents: 200,
    items: [{ product_id: FAKE_UUID, qty: 1, title: 'Producto Stress' }],
    turnstile_token: 'stress-token',
    ...overrides,
  })
}

async function runBatch(path, total, optsFactory, headersFactory) {
  const results = []
  let next = 0
  const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, async () => {
    while (true) {
      const i = next++
      if (i >= total) return
      results.push(await timedFetch(path, optsFactory(i), headersFactory(i)))
    }
  })
  await Promise.all(workers)
  return results
}

function summarize(name, results) {
  const statuses = {}
  let totalMs = 0
  let maxMs = 0
  const errors = []
  for (const r of results) {
    statuses[r.status ?? 'ERR'] = (statuses[r.status ?? 'ERR'] ?? 0) + 1
    if (r.ms) {
      totalMs += r.ms
      if (r.ms > maxMs) maxMs = r.ms
    }
    if (r.status >= 500 || r.error) errors.push(r)
  }
  const sorted = results.map((r) => r.ms).filter((m) => m !== undefined).sort((a, b) => a - b)
  const pct = (p) => sorted.length ? sorted[Math.floor(sorted.length * p)] : 0
  console.log(`\n=== ${name} ===`)
  console.log(`  total=${results.length} statuses=${JSON.stringify(statuses)}`)
  console.log(`  avg=${(totalMs / (results.length || 1)).toFixed(1)}ms p95=${pct(0.95).toFixed(1)}ms p99=${pct(0.99).toFixed(1)}ms max=${maxMs.toFixed(1)}ms`)
  if (errors.length) {
    console.log(`  ⚠ ${errors.length} errores/5xx (primeros 3):`)
    for (const e of errors.slice(0, 3)) {
      console.log(`    → ${e.path} status=${e.status} ms=${e.ms?.toFixed(0)} err=${e.error ?? ''} body=${JSON.stringify(e.body)?.slice(0, 140)}`)
    }
  }
  return { statuses, errors: errors.length }
}

async function main() {
  console.log(`Stress audit — base=${BASE} concurrency=${CONCURRENCY} total=${TOTAL}\n`)

  // 1. Checkout whatsapp con MISMA IP (debe disparar 429 tras la primera)
  const sameIp = await runBatch(
    '/api/checkout/whatsapp',
    TOTAL,
    () => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: makeCheckoutBody() }),
    () => ({ 'x-forwarded-for': '10.0.0.1' })
  )
  const rlSame = summarize('POST /api/checkout/whatsapp — misma IP (rate limit 15s)', sameIp)

  // 2. Checkout whatsapp con IPs variadas (spoofing XFF — defensa en profundidad vs Turnstile)
  const spoofIp = await runBatch(
    '/api/checkout/whatsapp',
    Math.min(TOTAL, 40),
    () => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: makeCheckoutBody() }),
    () => ({ 'x-forwarded-for': randIp() })
  )
  const rlSpoof = summarize('POST /api/checkout/whatsapp — IPs variadas', spoofIp)

  // 3. Cupones apply — misma IP (rate limit 10s)
  const coupons = await runBatch(
    '/api/coupons/apply',
    Math.min(TOTAL, 40),
    () => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: 'STRESS99', subtotal_cents: 5000, customer_email: 'stress@munay.test' }) }),
    () => ({ 'x-forwarded-for': '10.0.0.2' })
  )
  summarize('POST /api/coupons/apply — misma IP (rate limit 10s)', coupons)

  // 4. Catálogo + home (carga pública bajo presión)
  const catalog = await runBatch('/catalogo', Math.min(TOTAL, 40), () => ({}), () => ({ 'x-forwarded-for': randIp() }))
  summarize('GET /catalogo — carga bajo presión', catalog)

  const home = await runBatch('/', Math.min(TOTAL, 30), () => ({}), () => ({ 'x-forwarded-for': randIp() }))
  summarize('GET / — home bajo presión', home)

  const totalErrors = rlSame.errors + rlSpoof.errors
  console.log(`\n⚠ Total 5xx/errores de red: ${totalErrors}`)
  process.exit(totalErrors > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
