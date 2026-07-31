'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  listingId: string
  action: 'verified' | 'rejected'
  children: React.ReactNode
}

export function VerifyListingButton({ listingId, action, children }: Props) {
  const [state, formAction, isPending] = useActionState(async () => {
    try {
      const res = await fetch('/api/admin/listings/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, status: action }),
      })
      const data = await res.json()
      if (data.ok) {
        // Refresh page to show updated status
        window.location.reload()
      }
      return data
    } catch {
      return { error: 'Error de conexión' }
    }
  }, null)

  const variant = action === 'verified' ? 'default' : 'destructive'

  return (
    <form action={formAction}>
      <Button
        type="submit"
        disabled={isPending}
        variant={variant}
        size="sm"
        className="rounded-lg text-xs"
      >
        {isPending ? '…' : children}
      </Button>
    </form>
  )
}
