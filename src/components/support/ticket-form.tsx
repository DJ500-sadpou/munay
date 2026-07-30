'use client'

import { useState } from 'react'
import {
  MessageCircle,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Step = 'form' | 'sending' | 'success' | 'error'

export function TicketForm() {
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStep('sending')
    setError(null)

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, message }),
      })
      const data = await res.json()

      if (!data.ok) {
        throw new Error(data.error ?? 'Error al crear ticket')
      }

      setWhatsappUrl(data.whatsapp_url)
      setStep('success')
    } catch (err: any) {
      setError(err?.message ?? 'Error inesperado')
      setStep('error')
    }
  }

  if (step === 'success') {
    return (
      <Card className="border-munay-terracota/15 shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-munay-terracota/10 text-munay-terracota">
            <CheckCircle2 className="h-8 w-8" aria-hidden />
          </span>
          <h2 className="font-display text-2xl font-semibold text-munay-ink">¡Mensaje enviado!</h2>
          <p className="text-munay-ink/60">
            Tu ticket se ha registrado. Para darte una respuesta más rápida,
            puedes enviarnos un mensaje directo por WhatsApp:
          </p>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2"
            >
              <Button className="bg-munay-whatsapp text-white hover:bg-munay-whatsapp/90">
                <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
                Abrir WhatsApp
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </a>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setStep('form')
              setName('')
              setEmail('')
              setPhone('')
              setMessage('')
            }}
          >
            Enviar otro mensaje
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-black/5 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-munay-terracota" aria-hidden />
          Contáctanos
        </CardTitle>
        <CardDescription>
          Escríbenos y te responderemos a la brevedad. O si prefieres,
          escríbenos directamente a{' '}
          <a
            href="https://wa.me/+593959756845"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-munay-terracota underline underline-offset-2"
          >
            WhatsApp
          </a>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ticket-name">Nombre *</Label>
              <Input
                id="ticket-name"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                disabled={step === 'sending'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-email">Email *</Label>
              <Input
                id="ticket-email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={step === 'sending'}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticket-phone">Teléfono (opcional)</Label>
            <Input
              id="ticket-phone"
              type="tel"
              placeholder="+593 99 000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={step === 'sending'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticket-message">Mensaje *</Label>
            <Textarea
              id="ticket-message"
              placeholder="Cuéntanos en qué podemos ayudarte..."
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              minLength={10}
              maxLength={2000}
              disabled={step === 'sending'}
            />
            <p className="text-xs text-munay-ink/50 text-right">
              {message.length}/2000 caracteres
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-munay-terracota/20 bg-munay-terracota/5 px-4 py-3 text-sm text-munay-terracota">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full bg-munay-terracota text-white hover:bg-munay-terracota-quemado"
            disabled={step === 'sending'}
          >
            {step === 'sending' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Enviando…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" aria-hidden />
                Enviar mensaje
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
