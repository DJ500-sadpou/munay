/**
 * Hook para evitar hydration mismatch al usar Zustand con persistencia
 * en localStorage. Retorna `true` cuando el componente ya está montado
 * en el cliente (post-hidratación).
 *
 * Patrón recomendado por React 19 con useSyncExternalStore.
 */

'use client'

import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}

export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,   // cliente: siempre true después del mount
    () => false   // servidor: siempre false
  )
}
