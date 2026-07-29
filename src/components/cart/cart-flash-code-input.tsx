'use client'

import { useState } from 'react'
import { Check, AlertCircle, Loader2, Zap, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCart, type CartFlashCode } from '@/store/cart'
import { formatCents } from '@/lib/format'
import { TurnstileWidget } from '@/components/auth/turnstile-widget'

interface ValidateResponse {
  valid: boolean
  reason?: string
  code?: string
  type?: 'discount' | 'unlock'
  discount_percent?: number | null
  discount_cents?: number | null
  ends_at?: string
  remaining_uses?: number | null
}

export function CartFlashCodeInput() {
  const flashCode = useCart((s) => s.flashCode)
  const setFlashCode = useCart((s) => s.setFlashCode)
  const subtotalCents = useCart((s) => s.subtotalCents())

  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [validatedInfo, setValidatedInfo] = useState<ValidateResponse | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const handleApply = async () => {
    const code = input.trim().toUpperCase()
    if (code.length < 4) {
      setStatus('error')
      setErrorMsg('El código debe tener al menos 4 caracteres.')
      return
    }

    if (!turnstileToken) {
      setStatus('error')
      setErrorMsg('Completa la verificación anti-bot primero.')
      return
    }

    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/flash/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, turnstile_token: turnstileToken }),
      })
      const data: ValidateResponse = await res.json()

      if (!data.valid) {
        setStatus('error')
        setErrorMsg(data.reason ?? 'Código inválido.')
        setFlashCode(null)
        setValidatedInfo(null)
        return
      }

      setStatus('success')
      const fc: CartFlashCode = {
        code: data.code!,
        type: data.type!,
        discount_percent: data.discount_percent ?? null,
        discount_cents: data.discount_cents ?? null,
      }
      setFlashCode(fc)
      setValidatedInfo(data)
      setInput('')
    } catch {
      setStatus('error')
      setErrorMsg('Error de conexión. Intenta nuevamente.')
    }
  }

  const handleRemove = () => {
    setFlashCode(null)
    setValidatedInfo(null)
    setStatus('idle')
    setErrorMsg('')
  }

  // Si ya hay un código aplicado
  if (flashCode) {
    const discountCents = useCart.getState().discountCents()
    return (
      <div className="rounded-md border border-accent/40 bg-accent/10 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-accent-foreground">Código flash aplicado</p>
            <p className="font-mono text-lg font-bold text-accent">{flashCode.code}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRemove}
            aria-label="Quitar código"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {flashCode.type === 'discount' && (
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descuento</span>
              <span className="font-medium text-primary">
                {flashCode.discount_percent != null
                  ? `${flashCode.discount_percent}%`
                  : flashCode.discount_cents != null
                  ? formatCents(flashCode.discount_cents)
                  : '—'}
              </span>
            </div>
            {subtotalCents > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ahorro</span>
                <span className="font-medium text-primary">−{formatCents(discountCents)}</span>
              </div>
            )}
          </div>
        )}

        {flashCode.type === 'unlock' && (
          <p className="text-xs text-muted-foreground">
            Piezas exclusivas desbloqueadas en el catálogo.
          </p>
        )}

        {validatedInfo?.ends_at && (
          <p className="text-[10px] text-muted-foreground">
            Válido hasta {new Date(validatedInfo.ends_at).toLocaleDateString('es-EC')}
          </p>
        )}
      </div>
    )
  }

  // Formulario para aplicar código
  return (
    <div className="space-y-2">
      <Label htmlFor="flash-input" className="text-xs font-medium">
        ¿Tienes un código flash?
      </Label>
      <div className="flex gap-2">
        <Input
          id="flash-input"
          type="text"
          placeholder="MUNAY10"
          className="uppercase font-mono tracking-widest"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleApply()
            }
          }}
          disabled={status === 'loading'}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleApply}
          disabled={status === 'loading' || !input.trim() || !turnstileToken}
        >
          {status === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : status === 'success' ? (
            <Check className="h-4 w-4 text-primary" aria-hidden />
          ) : (
            <>
              <Zap className="h-4 w-4" aria-hidden />
              <span className="sr-only sm:not-sr-only sm:ml-1">Aplicar</span>
            </>
          )}
        </Button>
      </div>

      <TurnstileWidget onVerify={setTurnstileToken} className="min-h-[65px]" />

      {status === 'error' && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" aria-hidden />
          {errorMsg}
        </p>
      )}

      {status === 'success' && (
        <p className="flex items-center gap-1.5 text-xs text-primary">
          <Check className="h-3 w-3" aria-hidden />
          Código aplicado correctamente.
        </p>
      )}

      <p className="text-[10px] text-muted-foreground">
        El descuento se aplicará al total en el checkout.
      </p>
    </div>
  )
}
