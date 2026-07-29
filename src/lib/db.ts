/**
 * Nota: Este proyecto usa Supabase como base de datos (NO Prisma).
 *
 * Clientes disponibles:
 *   - Browser: `import { createBrowserClient } from '@/lib/supabase/client'`
 *   - Server:  `import { createServerClient } from '@/lib/supabase/server'`
 *   - Admin:   `import { createAdminClient }   from '@/lib/supabase/admin'` (⚠️ service role, bypass RLS)
 *
 * Tipos TS del esquema: `import type { Database } from '@/types/database'`
 *
 * Este archivo se mantiene solo para compatibilidad con imports existentes
 * del scaffold. Si tu código no usa Prisma, puedes borrarlo.
 */
export const db = null
