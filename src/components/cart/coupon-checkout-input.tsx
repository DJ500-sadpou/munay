'use client'

import { useState } from 'react'
import { Check, AlertCircle, Loader2, Ticket, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Campo de cupón de descuento (tabla `coupons`) en el checkout.
 *
 * [F3] Reemplaza a CartFlashCodeInput: los códigos flash ya NO aplican
 * descuento en el checkout (son mecanismo de descubrimiento). Los
 * descuentos se validan contra /api/coupons/apply (preview, NO consume)
 * y se consumen SOLO en createOrder.
 *
 * Feedback de errores: aplicado ✓ / monto mínimo / agotado / vencido /
 * primera compra / no encontrado.
 */

export interface AppliedCoupon {
  codigo: string
  discount_percent: number
}

interface Props {
  subtotalCents: number
  customerEmail?: string
  value: AppliedCoupon | null
  onChange: (coupon: AppliedCoupon | null) => void
}

export function CouponCheckoutInput({ subtotalCents, customerEmail, value, onChange }: Props) {
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleApply = async () => {
    const codigo = input.trim().toUpperCase()
    if (codigo.length < 4) {
      setStatus('error')
      setErrorMsg('El código debe tener al menos 4 caracteres.')
      return
    }
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/coupons/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          subtotal_cents: subtotalCents,
          customer_email: customerEmail ?? '',
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        setStatus('error')
        setErrorMsg(data.error ?? 'Cupón inválido.')
        return
      }
      setStatus('success')
      onChange({ codigo: data.codigo, discount_percent: data.discount_percent })
      setInput('')
    } catch {
      setStatus('error')
      setErrorMsg('Error de conexión. Intenta nuevamente.')
    }
  }

  const handleRemove = () => {
    onChange(null)
    setStatus('idle')
    setErrorMsg('')
  }

  // Cupón ya aplicado.
  // [FIX Ronda 2] Se muestra el % (no un monto en $) porque el descuento
  // EFECTIVO se decide en createOrder con max(coupon, loyalty): si el cupón
  // de fidelidad es mayor, el monto del chip sería engañoso. El monto real
  // aparece en el resumen del checkout (promoDiscountCents).
  if (value) {
    return (
      <div className="rounded-md border border-accent/40 bg-accent/10 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-accent-foreground">Cupón aplicado</p>
            <p className="font-mono text-lg font-bold text-accent">{value.codigo}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRemove}
            aria-label="Quitar cupón"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Descuento</span>
          <span className="font-medium text-primary">{value.discount_percent}%</span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Se revalida al confirmar el pedido (monto mínimo, vigencia y usos).
        </p>
      </div>
    )
  }

  // Formulario para aplicar cupón
  return (
    <div className="space-y-2">
      <Label htmlFor="coupon-input" className="text-xs font-medium">
        ¿Tienes un cupón de descuento?
      </Label>
      <div className="flex gap-2">
        <Input
          id="coupon-input"
          type="text"
          placeholder="MUNAY25"
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
          disabled={status === 'loading' || !input.trim()}
        >
          {status === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : status === 'success' ? (
            <Check className="h-4 w-4 text-primary" aria-hidden />
          ) : (
            <>
              <Ticket className="h-4 w-4" aria-hidden />
              <span className="sr-only sm:not-sr-only sm:ml-1">Aplicar</span>
            </>
          )}
        </Button>
      </div>

      {status === 'error' && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" aria-hidden />
          {errorMsg}
        </p>
      )}

      <p className="text-[10px] text-muted-foreground">
        El descuento se aplicará al total en el checkout.
      </p>
    </div>
  )
}
