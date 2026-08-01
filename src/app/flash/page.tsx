import { redirect } from 'next/navigation'

/**
 * /flash — [F3] Redirige al catálogo.
 *
 * Los códigos flash ya NO son una lista pública de descuentos: son un
 * mecanismo de descubrimiento que se usa desde la barra de búsqueda del
 * catálogo (redirige a /flash/[code]). Los cupones de descuento viven en
 * la sección "Cupones y ofertas" de la landing (#cupones-y-ofertas).
 */

// [P2a] Metadata actualizada: el módulo se llama "Cupones" y vive en /cupones.
export const metadata = { title: 'Cupones' }

export default function FlashPage() {
  redirect('/catalogo')
}
