'use client'

import { MessageCircle } from 'lucide-react'
import { SITE } from '@/lib/constants'

/**
 * Botón flotante de WhatsApp — visible en todas las páginas.
 * Abre el chat directo de WhatsApp en una nueva pestaña.
 */
export function WhatsAppFloat() {
  return (
    <a
      href={SITE.whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-munay-whatsapp text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl active:scale-95"
    >
      <MessageCircle className="h-7 w-7" aria-hidden="true" />
    </a>
  )
}
