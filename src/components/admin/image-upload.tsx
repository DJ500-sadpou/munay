'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  ImagePlus, Loader2, AlertCircle, ImageOff,
  ChevronUp, ChevronDown, Star, Trash2,
} from 'lucide-react'
import { Label } from '@/components/ui/label'

declare global {
  interface Window {
    cloudinary: any
  }
}

interface ImageData {
  url: string
  public_id?: string
  sort?: number
}

interface ImageUploadProps {
  images: ImageData[]
  onImagesChange: (images: ImageData[]) => void
  maxImages?: number
  aspectRatio?: number | null
}

export function ImageUpload({
  images,
  onImagesChange,
  maxImages = 5,
  aspectRatio = 1,
}: ImageUploadProps) {
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const widgetRef = useRef<any>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    if (typeof window === 'undefined') return

    if (window.cloudinary) {
      setLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://upload-widget.cloudinary.com/global/all.js'
    script.async = true
    script.onload = () => {
      if (mountedRef.current) setLoaded(true)
    }
    script.onerror = () => {
      if (mountedRef.current) setError('Error al cargar el selector de imágenes.')
    }
    document.body.appendChild(script)

    return () => {
      mountedRef.current = false
      if (widgetRef.current) {
        try { widgetRef.current.close() } catch { /* noop */ }
      }
    }
  }, [])

  // ------------------------------------------------------------------
  // Acciones
  // ------------------------------------------------------------------

  const openWidget = async () => {
    if (!loaded || images.length >= maxImages) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/products/upload-signature', { method: 'POST' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Error al obtener firma')

      const widgetOptions: any = {
        cloudName: data.cloudName,
        apiKey: data.apiKey,
        uploadSignature: (cb: any) => cb(data.signature),
        uploadSignatureTimestamp: data.timestamp,
        folder: data.folder,
        sources: ['local', 'url', 'camera'],
        multiple: true,
        maxFiles: maxImages - images.length,
        showAdvancedOptions: false,
        styles: {
          palette: {
            window: '#FFFFFF',
            windowBorder: '#E2E8F0',
            tabIcon: '#DC2626',
            menuIcons: '#DC2626',
            textDark: '#1E293B',
            textLight: '#FFFFFF',
            link: '#DC2626',
            action: '#DC2626',
            inProgress: '#DC2626',
            complete: '#22C55E',
            error: '#EF4444',
            sourceBg: '#F8FAFC',
          },
        },
      }
      if (aspectRatio) {
        widgetOptions.cropping = true
        widgetOptions.cropping_aspect_ratio = aspectRatio
        widgetOptions.cropping_default_selection_ratio = aspectRatio
      }

      widgetRef.current = window.cloudinary.createUploadWidget(
        widgetOptions,
        (err: any, result: any) => {
          if (err) { setError('Error al procesar la imagen.'); return }
          if (result && result.event === 'success') {
            const info = result.info
            const maxSort = images.reduce((max, img) => Math.max(max, img.sort ?? 0), -1)
            onImagesChange([...images, {
              url: info.secure_url,
              public_id: info.public_id,
              sort: maxSort + 1,
            }])
            setError(null)
          }
        },
      )
      widgetRef.current.open()
    } catch (e: any) {
      setError(e?.message ?? 'Error al conectar con el servidor.')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  /** Mover imagen una posición hacia arriba */
  const moveUp = (index: number) => {
    if (index <= 0) return
    const updated = [...images]
    ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    onImagesChange(updated.map((img, i) => ({ ...img, sort: i })))
  }

  /** Mover imagen una posición hacia abajo */
  const moveDown = (index: number) => {
    if (index >= images.length - 1) return
    const updated = [...images]
    ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
    onImagesChange(updated.map((img, i) => ({ ...img, sort: i })))
  }

  /** Establecer como imagen principal (sort = 0) */
  const setAsMain = (index: number) => {
    if (index === 0) return
    const updated = [...images]
    const [img] = updated.splice(index, 1)
    updated.unshift(img)
    onImagesChange(updated.map((img, i) => ({ ...img, sort: i })))
  }

  /** Eliminar imagen del estado local (y de Cloudinary si tiene public_id) */
  const removeImage = async (index: number) => {
    const img = images[index]

    // Si tiene public_id, intentar eliminar de Cloudinary
    if (img.public_id) {
      setDeleting(index)
      try {
        await fetch('/api/admin/products/images', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId: img.public_id }),
        })
      } catch {
        // Si falla, igual la quitamos del estado local
        console.warn('No se pudo eliminar de Cloudinary:', img.public_id)
      } finally {
        setDeleting(null)
      }
    }

    // Quitar del estado local
    const updated = images
      .filter((_, i) => i !== index)
      .map((img, i) => ({ ...img, sort: i }))
    onImagesChange(updated)
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Imágenes del producto</Label>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((img, i) => (
          <div
            key={img.url}
            className="relative group aspect-square rounded-lg overflow-hidden border border-black/5 bg-white"
          >
            <Image
              src={img.url}
              alt={`Imagen ${i + 1}`}
              fill
              className="object-cover"
              sizes="200px"
            />

            {/* Overlay de acciones en hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
              {/* Mover arriba */}
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => moveUp(i)}
                  className="p-1.5 rounded-full bg-white/90 text-munay-ink hover:bg-white shadow-sm transition-all"
                  aria-label="Mover arriba"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
              )}
              {/* Mover abajo */}
              {i < images.length - 1 && (
                <button
                  type="button"
                  onClick={() => moveDown(i)}
                  className="p-1.5 rounded-full bg-white/90 text-munay-ink hover:bg-white shadow-sm transition-all"
                  aria-label="Mover abajo"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              )}
              {/* Establecer como principal (solo si no lo es ya) */}
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => setAsMain(i)}
                  className="p-1.5 rounded-full bg-white/90 text-amber-600 hover:bg-white shadow-sm transition-all"
                  aria-label="Establecer como principal"
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
              )}
              {/* Eliminar */}
              <button
                type="button"
                onClick={() => removeImage(i)}
                disabled={deleting === i}
                className="p-1.5 rounded-full bg-white/90 text-destructive hover:bg-white shadow-sm transition-all disabled:opacity-50"
                aria-label="Eliminar imagen"
              >
                {deleting === i ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {/* Badge principal (siempre visible) */}
            {i === 0 && (
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-munay-red-600/80 text-white shadow-sm">
                Principal
              </span>
            )}
          </div>
        ))}

        {/* Botón agregar */}
        {images.length < maxImages && (
          <button
            type="button"
            onClick={openWidget}
            disabled={!loaded || loading}
            className="aspect-square rounded-lg border-2 border-dashed border-black/10 hover:border-munay-red-600/50 transition-colors flex flex-col items-center justify-center gap-1 text-munay-ink/40 hover:text-munay-red-600/60 disabled:opacity-50 bg-munay-cream/10"
            aria-label="Agregar imagen"
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : !loaded ? (
              <Loader2 className="h-6 w-6 animate-spin text-munay-ink/20" />
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
            <span className="text-xs">
              {loading ? 'Conectando...' : !loaded ? 'Cargando...' : `${images.length}/${maxImages}`}
            </span>
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-destructive bg-destructive/5 rounded-md border border-destructive/20">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {images.length === 0 && !error && (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-munay-ink/40 bg-munay-cream/10 rounded-md">
          <ImageOff className="h-4 w-4 shrink-0" />
          <span>Sin imágenes. Haz clic en el recuadro punteado para subir.</span>
        </div>
      )}

      <p className="text-xs text-munay-ink/40">
        Formatos: JPG, PNG, WebP (máx 5 MB c/u). Máximo {maxImages} imágenes.
        Pasa el cursor sobre cada imagen para reordenar o eliminar.
        Se optimizan automáticamente.
      </p>
    </div>
  )
}
