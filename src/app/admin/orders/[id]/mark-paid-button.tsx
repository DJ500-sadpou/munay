'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  orderId: string
}

export function MarkAsPaidButton({ orderId }: Props) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentNote, setPaymentNote] = useState('')

  const handleClick = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_note: paymentNote.trim() || undefined }),
      })
      const data = await res.json()

      if (!data.ok) {
        throw new Error(data.error ?? 'Error al marcar como pagada')
      }

      setDone(true)
    } catch (err: any) {
      setError(err?.message ?? 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm text-primary">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Orden marcada como pagada
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-xs">
      <Input
        placeholder="Método de pago (ej: transferencia, efectivo...)"
        value={paymentNote}
        onChange={(e) => setPaymentNote(e.target.value)}
        disabled={loading}
        className="text-sm h-8"
      />
      {error && (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}
      <Button
        onClick={handleClick}
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Marcando…
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Marcar como pagada
          </>
        )}
      </Button>
    </div>
  )
}
