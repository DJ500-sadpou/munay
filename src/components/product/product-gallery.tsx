'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, ImageOff, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface GalleryImage {
  id?: string
  url: string
  sort?: number
}

interface ProductGalleryProps {
  images: GalleryImage[]
  title: string
  /** Porcentaje de descuento flash (se muestra en la imagen) */
  flashDiscountPercent?: number | null
  condition?: string
}

export function ProductGallery({
  images,
  title,
  flashDiscountPercent,
  condition,
}: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loaded, setLoaded] = useState<Record<number, boolean>>({})

  // Si no hay imágenes, mostrar placeholder
  if (!images || images.length === 0) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-xl border border-black/5 bg-munay-cream/20 shadow-sm flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-munay-ink/30">
          <ImageOff className="h-16 w-16" aria-hidden />
          <span className="text-sm">Sin imagen disponible</span>
        </div>
      </div>
    )
  }

  // Asegurar índice válido
  const currentIndex = Math.min(selectedIndex, images.length - 1)
  const currentImage = images[currentIndex]

  const goTo = useCallback((index: number) => {
    setSelectedIndex(Math.max(0, Math.min(index, images.length - 1)))
  }, [images.length])

  const goPrev = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex])
  const goNext = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex])

  const handleImageLoad = useCallback((index: number) => {
    setLoaded((prev) => ({ ...prev, [index]: true }))
  }, [])

  return (
    <div className="space-y-3">
      {/* Imagen principal */}
      <div className="relative aspect-square overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm group">
        {/* Loading skeleton */}
        {!loaded[currentIndex] && (
          <div className="absolute inset-0 flex items-center justify-center bg-munay-cream/10 animate-pulse">
            <Sparkles className="h-12 w-12 text-munay-ink/10" aria-hidden />
          </div>
        )}

        <Image
          key={currentImage.url}
          src={currentImage.url}
          alt={`${title} — imagen ${currentIndex + 1}`}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className={`object-cover transition-opacity duration-300 ${
            loaded[currentIndex] ? 'opacity-100' : 'opacity-0'
          }`}
          priority={currentIndex === 0}
          onLoad={() => handleImageLoad(currentIndex)}
        />

        {/* Condición badge */}
        {condition && (
          <Badge variant={condition === 'new' ? 'default' : 'secondary'} className="absolute left-3 top-3 shadow-sm">
            {condition === 'new' ? 'Nuevo' : 'Usado'}
          </Badge>
        )}

        {/* Flash discount badge */}
        {flashDiscountPercent != null && flashDiscountPercent > 0 && (
          <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-munay-red-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            -{flashDiscountPercent}%
          </span>
        )}

        {/* Navegación entre imágenes */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 text-munay-ink opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white disabled:opacity-0 shadow-sm"
              aria-label="Imagen anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={currentIndex === images.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 text-munay-ink opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white disabled:opacity-0 shadow-sm"
              aria-label="Imagen siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Contador */}
            <span className="absolute bottom-3 right-3 inline-flex items-center rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
              {currentIndex + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {images.map((img, i) => (
            <button
              key={img.id ?? img.url}
              type="button"
              onClick={() => goTo(i)}
              className={`relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                i === currentIndex
                  ? 'border-munay-red-600 ring-1 ring-munay-red-600/30'
                  : 'border-transparent hover:border-black/10'
              }`}
              aria-label={`Ir a imagen ${i + 1}`}
              aria-current={i === currentIndex ? 'true' : undefined}
            >
              <Image
                src={img.url}
                alt={`Miniatura ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
