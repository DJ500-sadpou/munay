/**
 * Postinstall: repara archivos .d.mts corruptos de @clerk/shared.
 *
 * Clerk envía archivos .d.mts que a veces se instalan con solo bytes nulos
 * (corrupción de disco/npm). Esto provoca TS1127 (invalid character) en tsc.
 *
 * Este script detecta esos archivos y los reemplaza con `export {}` válido.
 * Se ejecuta automáticamente tras cada `npm install` via postinstall hook.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clerkDir = join(__dirname, '..', 'node_modules', '@clerk')

let repaired = 0

function walk(dir) {
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        walk(full)
      } else if (full.endsWith('.d.mts')) {
        const buf = readFileSync(full)
        if (buf.length > 0 && buf.every(b => b === 0)) {
          writeFileSync(full, 'export {}\n', 'utf-8')
          repaired++
        }
      }
    }
  } catch (err) {
    // Solo ignorar si el directorio no existe (proyecto sin Clerk o sin npm install)
    if (err.code !== 'ENOENT') throw err
  }
}

walk(clerkDir)

if (repaired > 0) {
  console.log(`[postinstall] Reparados ${repaired} archivo(s) .d.mts corruptos de @clerk/shared`)
}
