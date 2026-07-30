import { MessageCircle, Mail, ChevronRight } from 'lucide-react'
import { TicketForm } from '@/components/support/ticket-form'
import { SITE } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = {
  title: 'Soporte · Munay',
  description: 'Contáctanos para resolver cualquier duda sobre tus pedidos, envíos o devoluciones.',
}

const FAQ = [
  { q: '¿Cuánto tarda el envío a Ibarra?', a: 'El envío a Ibarra es gratuito y se entrega en 1-2 días hábiles.' },
  { q: '¿Hacen envíos a todo Ecuador?', a: 'Sí, enviamos a todo Ecuador vía Servientrega. El costo varía según la provincia.' },
  { q: '¿Puedo devolver una prenda?', a: 'Sí, aceptamos devoluciones dentro de los 7 días posteriores a la entrega. La prenda debe estar en el mismo estado.' },
  { q: '¿Cómo uso un código flash?', a: 'Ingresa el código en /flash o péguelo en la búsqueda del catálogo. Se aplicará automáticamente.' },
]

export default function SoportePage() {
  return (
    <div className="bg-gradient-to-b from-white via-munay-crema/10 to-white">
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <span className="mb-3 inline-block rounded-full bg-munay-red-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-munay-red-600">
            Soporte
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight text-munay-ink sm:text-4xl">
            ¿En qué podemos ayudarte?
          </h1>
          <p className="mt-2 text-munay-ink/60">
            Estamos aquí para resolver tus dudas. Escríbenos o revisa las preguntas frecuentes.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* Formulario */}
          <div>
            <TicketForm />
          </div>

          {/* Sidebar: FAQ + contacto directo */}
          <div className="space-y-6">
            {/* Contacto directo */}
            <Card className="border-black/5 shadow-sm">
              <CardContent className="space-y-4 p-6">
                <h2 className="font-display text-lg font-semibold text-munay-ink">Contacto directo</h2>

                <a
                  href={SITE.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-black/5 bg-munay-whatsapp/5 p-3 text-sm transition-colors hover:bg-munay-whatsapp/10"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-munay-whatsapp text-white">
                    <MessageCircle className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-munay-ink">WhatsApp</p>
                    <p className="text-xs text-munay-ink/60">Respuesta en minutos</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-munay-ink/30" aria-hidden />
                </a>

                <a
                  href={`mailto:${SITE.email}`}
                  className="flex items-center gap-3 rounded-lg border border-black/5 bg-munay-terracota/5 p-3 text-sm transition-colors hover:bg-munay-terracota/10"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-munay-terracota text-white">
                    <Mail className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-munay-ink">Email</p>
                    <p className="text-xs text-munay-ink/60">{SITE.email}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-munay-ink/30" aria-hidden />
                </a>
              </CardContent>
            </Card>

            {/* FAQ */}
            <Card className="border-black/5 shadow-sm">
              <CardContent className="p-6">
                <h2 className="font-display text-lg font-semibold text-munay-ink mb-4">
                  Preguntas frecuentes
                </h2>
                <div className="space-y-3">
                  {FAQ.map((item) => (
                    <details key={item.q} className="group">
                      <summary className="cursor-pointer list-none text-sm font-medium text-munay-ink transition-colors hover:text-munay-terracota">
                        {item.q}
                      </summary>
                      <p className="mt-2 pl-0 text-xs leading-relaxed text-munay-ink/60">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
