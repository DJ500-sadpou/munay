/**
 * [P2c][FIX Ronda 5] Almacenamiento compartido del cupón "preferido".
 *
 * Antes el parsing + TTL del cupón elegido en /cupones ("Usar cupón") estaba
 * DUPLICADO entre `src/components/cupones/cupones-client.tsx` y
 * `src/app/checkout/page.tsx` con la constante 60*60*1000 hardcodeada en uno
 * de los dos — riesgo real de drift silencioso. Este módulo centraliza la
 * key, el TTL y las funciones de lectura/escritura/limpieza.
 *
 * Contrato del payload (JSON en localStorage):
 *   { "code": "MUNAY25", "at": 1699999999999 }
 *
 * Regla TTL: el preferido solo se aplica si fue elegido dentro de la ventana
 * (60 min). Un "Usar cupón" pulsado hace días NO debe auto-aplicarse en un
 * checkout futuro sin intención del usuario (el flujo vacío → catálogo →
 * checkout tarda minutos, no horas). Las entradas obsoletas, corruptas o del
 * formato viejo (string plano) se ignoran y se limpian.
 */

export const SELECTED_KEY = 'munay.cupones.selected'

export const SELECTED_TTL_MS = 60 * 60 * 1000 // 1 hora

export interface SelectedCoupon {
  code: string
  at: number
}

/**
 * Devuelve el código del cupón preferido SOLO si fue escrito dentro del TTL.
 * Limpia (removeItem) cualquier entrada vencida, malformada o del formato
 * viejo (string plano) — así no queda basura re-parseándose en cada visita.
 */
export function readSelected(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SELECTED_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as SelectedCoupon).code !== 'string' ||
      typeof (parsed as SelectedCoupon).at !== 'number'
    ) {
      // Formato viejo (string plano) o shape inválido → limpiar y no aplicar.
      window.localStorage.removeItem(SELECTED_KEY)
      return null
    }
    if (Date.now() - (parsed as SelectedCoupon).at > SELECTED_TTL_MS) {
      window.localStorage.removeItem(SELECTED_KEY)
      return null
    }
    return (parsed as SelectedCoupon).code
  } catch {
    // JSON inválido (p. ej. formato viejo sin comillas) → limpiar y no aplicar.
    try {
      window.localStorage.removeItem(SELECTED_KEY)
    } catch {
      /* ignore */
    }
    return null
  }
}

/** Escribe el preferido con timestamp (o elimina si code es null). */
export function writeSelected(code: string | null) {
  try {
    if (code) {
      const payload: SelectedCoupon = { code, at: Date.now() }
      window.localStorage.setItem(SELECTED_KEY, JSON.stringify(payload))
    } else {
      window.localStorage.removeItem(SELECTED_KEY)
    }
  } catch {
    /* localStorage no disponible (SSR/privacy mode) — no crítico */
  }
}

/** Elimina el preferido (p. ej. tras aplicarlo exitosamente en checkout). */
export function clearSelected() {
  try {
    window.localStorage.removeItem(SELECTED_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * [P1] Cupón YA VALIDADO en el carrito/checkout (preview). Key SEPARADA del
 * "preferido" (SELECTED_KEY): el preferido es intención futura con TTL 1h;
 * el "aplicado" es la intención ACTUAL del carrito, sin TTL — se limpia al
 * quitar el cupón, al vaciar el carrito o al consumirse en createOrder.
 *
 * Por qué sin TTL: el carrito puede estar horas abierto; el descuento es
 * SOLO preview y `createOrder` revalida y consume server-side, así que un
 * payload obsoleto nunca produce un total incorrecto final (el error 422
 * del cupón vencido/agotado aparece al confirmar, no silenciosamente).
 */
export const APPLIED_KEY = 'munay.cupones.applied'

export interface AppliedCouponPayload {
  codigo: string
  discount_percent: number
}

/**
 * Devuelve el cupón aplicado SOLO si tiene shape válido. Limpia entradas
 * corruptas (no re-parsea basura en cada visita).
 */
export function readApplied(): AppliedCouponPayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(APPLIED_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as AppliedCouponPayload).codigo !== 'string' ||
      typeof (parsed as AppliedCouponPayload).discount_percent !== 'number'
    ) {
      window.localStorage.removeItem(APPLIED_KEY)
      return null
    }
    return parsed as AppliedCouponPayload
  } catch {
    try {
      window.localStorage.removeItem(APPLIED_KEY)
    } catch {
      /* ignore */
    }
    return null
  }
}

/** Escribe el cupón aplicado (o elimina si payload es null). */
export function writeApplied(payload: AppliedCouponPayload | null) {
  try {
    if (payload) {
      window.localStorage.setItem(APPLIED_KEY, JSON.stringify(payload))
    } else {
      window.localStorage.removeItem(APPLIED_KEY)
    }
  } catch {
    /* localStorage no disponible (SSR/privacy mode) — no crítico */
  }
}

/** Elimina el cupón aplicado (quitar cupón / vaciar carrito / orden creada). */
export function clearApplied() {
  try {
    window.localStorage.removeItem(APPLIED_KEY)
  } catch {
    /* ignore */
  }
}
