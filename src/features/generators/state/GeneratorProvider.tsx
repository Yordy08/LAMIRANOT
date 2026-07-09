import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ForegroundTransform } from '../types'

export interface ImagePosition {
  /** object-position horizontal (0–100 %). */
  x: number
  /** object-position vertical (0–100 %). */
  y: number
}

const DEFAULT_TRANSFORM: ForegroundTransform = { zoom: 1, x: 0, y: 0 }

interface GeneratorContextValue {
  category: string
  headline: string
  /** Imagen compartida entre plantillas, como dataURL (serializable/persistible). */
  imageDataUrl: string | null
  setCategory: (v: string) => void
  setHeadline: (v: string) => void
  setImageFile: (file: File | null) => void
  setImageFromUrl: (url: string) => Promise<boolean>
  /** Posición del encuadre, INDEPENDIENTE por plantilla (`templateId`). */
  getPosition: (templateId: string) => ImagePosition
  setPosition: (templateId: string, pos: ImagePosition) => void
  /** Modo "Redimensionar" (fondo desenfocado + imagen nítida), por plantilla. */
  getResizeMode: (templateId: string) => boolean
  setResizeMode: (templateId: string, value: boolean) => void
  /** Zoom + desplazamiento del primer plano (modo Redimensionar), por plantilla. */
  getTransform: (templateId: string) => ForegroundTransform
  setTransform: (templateId: string, t: ForegroundTransform) => void
  /** Escala del titular (multiplicador del tamaño base), por plantilla. */
  getHeadlineScale: (templateId: string) => number
  setHeadlineScale: (templateId: string, scale: number) => void
}

const DEFAULT_POSITION: ImagePosition = { x: 50, y: 50 }
const TEXT_KEY = 'cravernau:generator:text'
const IMAGE_KEY = 'cravernau:generator:image'

const GeneratorContext = createContext<GeneratorContextValue | null>(null)

type Positions = Record<string, ImagePosition>

interface PersistedText {
  category?: string
  headline?: string
  positions?: Positions
  resizeModes?: Record<string, boolean>
  transforms?: Record<string, ForegroundTransform>
  headlineScales?: Record<string, number>
}

function loadText(): PersistedText {
  try {
    return JSON.parse(localStorage.getItem(TEXT_KEY) ?? '{}') as PersistedText
  } catch {
    return {}
  }
}

/**
 * Provee el estado del generador (categoría, titular, imagen y posiciones) de
 * forma COMPARTIDA entre todas las plantillas, para que la imagen y los textos
  * se mantengan al cambiar entre pestañas. Las posiciones
 * del encuadre se guardan por plantilla.
 *
 * Persiste en localStorage: los textos/posiciones en una clave y la imagen
 * (dataURL) en otra, para no reescribir la imagen pesada en cada tecla o
 * arrastre. Si la imagen supera la cuota, se conserva en memoria igualmente.
 */
export function GeneratorProvider({ children }: { children: ReactNode }) {
  const initialText = useRef(loadText()).current
  const [category, setCategory] = useState(initialText.category ?? 'Última hora')
  const [headline, setHeadline] = useState(initialText.headline ?? '')
  const [positions, setPositions] = useState<Positions>(initialText.positions ?? {})
  const [resizeModes, setResizeModes] = useState<Record<string, boolean>>(
    initialText.resizeModes ?? {},
  )
  const [transforms, setTransforms] = useState<Record<string, ForegroundTransform>>(
    initialText.transforms ?? {},
  )
  const [headlineScales, setHeadlineScales] = useState<Record<string, number>>(
    initialText.headlineScales ?? {},
  )
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(
    () => localStorage.getItem(IMAGE_KEY),
  )

  // Persistir textos + posiciones + modos + transformaciones (payload pequeño).
  useEffect(() => {
    try {
      localStorage.setItem(
        TEXT_KEY,
        JSON.stringify({ category, headline, positions, resizeModes, transforms, headlineScales }),
      )
    } catch {
      /* cuota llena: se mantiene en memoria */
    }
  }, [category, headline, positions, resizeModes, transforms, headlineScales])

  // Persistir la imagen por separado (solo cuando cambia).
  useEffect(() => {
    try {
      if (imageDataUrl) localStorage.setItem(IMAGE_KEY, imageDataUrl)
      else localStorage.removeItem(IMAGE_KEY)
    } catch {
      /* imagen demasiado pesada para localStorage: solo en memoria */
    }
  }, [imageDataUrl])

  const setImageFile = useCallback((file: File | null) => {
    if (!file) {
      setImageDataUrl(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImageDataUrl(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }, [])

  const setImageFromUrl = useCallback(async (url: string) => {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    const localProxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`
    const responses = import.meta.env.DEV ? [url, proxyUrl] : [localProxyUrl, url, proxyUrl]

    for (const src of responses) {
      try {
        const response = await fetch(src)
        if (!response.ok) continue
        const blob = await response.blob()
        if (!blob.type.startsWith('image/')) continue
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result)
            else reject(new Error('Imagen inválida'))
          }
          reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
          reader.readAsDataURL(blob)
        })
        setImageDataUrl(dataUrl)
        return true
      } catch {
        /* intentar siguiente origen */
      }
    }

    return false
  }, [])

  const getPosition = useCallback(
    (templateId: string) => positions[templateId] ?? DEFAULT_POSITION,
    [positions],
  )

  const setPosition = useCallback((templateId: string, pos: ImagePosition) => {
    setPositions((prev) => ({ ...prev, [templateId]: pos }))
  }, [])

  const getResizeMode = useCallback(
    (templateId: string) => resizeModes[templateId] ?? false,
    [resizeModes],
  )

  const setResizeMode = useCallback((templateId: string, val: boolean) => {
    setResizeModes((prev) => ({ ...prev, [templateId]: val }))
  }, [])

  const getTransform = useCallback(
    (templateId: string) => transforms[templateId] ?? DEFAULT_TRANSFORM,
    [transforms],
  )

  const setTransform = useCallback((templateId: string, t: ForegroundTransform) => {
    setTransforms((prev) => ({ ...prev, [templateId]: t }))
  }, [])

  const getHeadlineScale = useCallback(
    (templateId: string) => headlineScales[templateId] ?? 1,
    [headlineScales],
  )

  const setHeadlineScale = useCallback((templateId: string, scale: number) => {
    setHeadlineScales((prev) => ({ ...prev, [templateId]: scale }))
  }, [])

  const value: GeneratorContextValue = {
    category,
    headline,
    imageDataUrl,
    setCategory,
    setHeadline,
    setImageFile,
    setImageFromUrl,
    getPosition,
    setPosition,
    getResizeMode,
    setResizeMode,
    getTransform,
    setTransform,
    getHeadlineScale,
    setHeadlineScale,
  }

  return <GeneratorContext.Provider value={value}>{children}</GeneratorContext.Provider>
}

export function useGenerator(): GeneratorContextValue {
  const ctx = use(GeneratorContext)
  if (!ctx) throw new Error('useGenerator debe usarse dentro de <GeneratorProvider>')
  return ctx
}
