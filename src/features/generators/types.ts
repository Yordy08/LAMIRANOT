import type { ComponentType } from 'react'

/**
 * Contenido editable que comparten todas las plantillas de noticias.
 * Solo estos tres campos cambian; el resto del diseño es fijo.
 */
export interface NewsTemplateData {
  category: string
  headline: string
  /** URL (object URL) de la imagen cargada, o null si aún no hay imagen. */
  imageUrl: string | null
}

/** Dimensiones nativas de exportación de una plantilla, en píxeles. */
export interface TemplateSize {
  width: number
  height: number
}

/** Posición del encuadre de la imagen (object-position en %). */
export interface ImagePosition {
  x: number
  y: number
}

/**
 * Transformación de la imagen en primer plano (modo Redimensionar):
 * zoom (escala) y desplazamiento en % del contenedor. Permite ampliar,
 * mover y recortar la imagen para ubicarla donde se desee.
 */
export interface ForegroundTransform {
  zoom: number
  x: number
  y: number
}

/** Props que recibe el componente visual de cualquier plantilla. */
export interface TemplateComponentProps {
  data: NewsTemplateData
  /** Posición del encuadre de la foto (arrastrable). */
  imagePosition?: ImagePosition
  /** Callback al arrastrar la foto para reposicionarla. */
  onPositionChange?: (pos: ImagePosition) => void
  /**
   * Modo "Redimensionar": muestra la imagen nítida en primer plano
   * (object-fit: contain, ampliable/desplazable) sobre una copia desenfocada de
   * la misma imagen como fondo, para adaptarla al formato sin deformar.
   */
  resizeMode?: boolean
  /** Zoom + desplazamiento de la imagen en primer plano (modo Redimensionar). */
  foreground?: ForegroundTransform
  /** Callback al ampliar/desplazar la imagen en primer plano. */
  onForegroundChange?: (t: ForegroundTransform) => void
  /** Escala del titular (multiplicador del tamaño base). */
  headlineScale?: number
}

export type TemplateComponent = ComponentType<TemplateComponentProps>

/**
 * Configuración visual de una plantilla basada en un marco PNG.
 *
 * El marco (`frameSrc`) es un overlay transparente que contiene TODO el diseño
 * fijo (degradados, logo, redes, marca de agua). La foto se coloca detrás y el
 * texto editable (categoría + titular) encima, en las coordenadas definidas
 * aquí. Todas las medidas son en píxeles del lienzo nativo.
 */
export interface FrameLayout {
  /** Marco PNG (transparente en la zona de la foto). */
  frameSrc: string
  /** Badge de categoría (rectángulo con gradiente rojo→negro y borde blanco). */
  badge: {
    left: number
    top: number
    /** Ancho mínimo; crece si el texto es más largo. */
    minWidth: number
    height: number
    fontSize: number
    fontWeight?: number
    paddingX: number
    /**
     * border-radius CSS (orden: top-left top-right bottom-right bottom-left).
     * Por defecto se redondean las esquinas opuestas: '18px 0 18px 0'.
     */
    borderRadius: string
    background?: string
    border?: string
    color?: string
    textStroke?: string
  }
  /** Titular editable. */
  headline: {
    left: number
    top: number
    right: number
    fontSize: number
    lineHeight: number
    fontWeight: number
    textAlign?: 'left' | 'center' | 'right'
    color?: string
    background?: string
    paddingX?: number
    paddingY?: number
  }
}

/**
 * Descriptor de una plantilla. Registrar una plantilla nueva
 * consiste únicamente en
 * crear su componente visual y exportar uno de estos objetos.
 */
export interface TemplateDefinition {
  /** Identificador único, usado en rutas y como key. */
  id: string
  /** Nombre visible para el usuario. */
  name: string
  /** Tamaño nativo de exportación (px). */
  size: TemplateSize
  /** Componente visual que dibuja la plantilla. */
  Component: TemplateComponent
  /** Nombre de archivo base para el PNG exportado (sin extensión). */
  exportFileName: string
  /** Valores iniciales opcionales para el formulario. */
  defaults?: Partial<NewsTemplateData>
}
