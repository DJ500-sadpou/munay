'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  couponId: string
}

export function CouponActions({ couponId }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<'reset' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleReset = async () => {
    if (!window.confirm('¿Resetear el contador de usos de este cupón a 0?')) return
    setBusy('reset')
    setError(null)
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}/reset-uses`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? 'Error al resetear')
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar este cupón? Los registros de uso se borrarán.')) return
    setBusy('delete')
    setError(null)
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? 'Error al eliminar')
    } finally {
      setBusy(null)
    }
  }

  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <Button
        size="sm"
        variant="ghost"
        onClick={handleReset}
        disabled={busy !== null}
        aria-label="Resetear usos"
        title="Resetear usos"
        className="h-7 w-7 px-0"
      >
        {busy === 'reset' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleDelete}
        disabled={busy !== null}
        aria-label="Eliminar cupón"
        title="Eliminar"
        className="h-7 w-7 px-0 text-destructive hover:text-destructive"
      >
        {busy === 'delete' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  )
}
