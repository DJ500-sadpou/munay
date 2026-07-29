/**
 * Detecta si la base de datos está configurada.
 *
 * Tras la migración a Neon, ya no usamos Supabase. Esta función
 * mantiene compatibilidad con código existente que importa
 * `isSupabaseConfigured` pero ahora verifica Neon.
 *
 * @deprecated Usar `isDbConfigured` de '@/lib/db/neon' directamente.
 */

import { isDbConfigured } from '@/lib/db/neon'

export function isSupabaseConfigured(): boolean {
  return isDbConfigured()
}
