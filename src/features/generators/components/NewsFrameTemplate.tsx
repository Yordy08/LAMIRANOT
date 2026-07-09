import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { ForegroundTransform, FrameLayout, ImagePosition, NewsTemplateData } from '../types'

interface NewsFrameTemplateProps {
  data: NewsTemplateData
  layout: FrameLayout
  imagePosition?: ImagePosition
  onPositionChange?: (pos: ImagePosition) => void
  resizeMode?: boolean
  foreground?: ForegroundTransform
  onForegroundChange?: (t: ForegroundTransform) => void
  headlineScale?: number
}

const FONT_HEADLINE =
  "'Arial Black', Arial, Helvetica, system-ui, sans-serif"

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// Estilos estáticos (se crean una sola vez, no en cada render).
const FILL: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' }
const ROOT_STYLE: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  background: '#000',
}
const BLUR_BG_STYLE: CSSProperties = {
  ...FILL,
  objectFit: 'cover',
  filter: 'blur(38px)',
  transform: 'scale(1.18)', // evita bordes transparentes del desenfoque
  pointerEvents: 'none',
}
const FG_BASE_STYLE: CSSProperties = {
  ...FILL,
  objectFit: 'contain',
  transformOrigin: 'center',
  touchAction: 'none',
  userSelect: 'none',
}
const COVER_BASE_STYLE: CSSProperties = {
  ...FILL,
  objectFit: 'cover',
  touchAction: 'none',
  userSelect: 'none',
}
const FRAME_STYLE: CSSProperties = { ...FILL, pointerEvents: 'none' }
const PLACEHOLDER_STYLE: CSSProperties = {
  ...FILL,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg,#20293b 0%,#111827 60%,#0b0f1a 100%)',
  color: 'rgba(255,255,255,0.28)',
  fontFamily: FONT_HEADLINE,
  fontSize: 40,
  letterSpacing: 2,
  textTransform: 'uppercase',
}
const BADGE_BASE_STYLE: CSSProperties = {
  position: 'absolute',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  border: '2px solid #ffffff',
  background: 'linear-gradient(90deg, #d0202c 0%, #c11a26 46%, #2c0510 70%, #0a0204 100%)',
  boxShadow: '0 6px 14px rgba(0,0,0,0.45)',
  pointerEvents: 'none',
}
const BADGE_TEXT_STYLE: CSSProperties = {
  fontFamily: FONT_HEADLINE,
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: 1,
  color: '#fff',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  textShadow: '0 2px 3px rgba(0,0,0,0.45)',
}
const HEADLINE_BASE_STYLE: CSSProperties = {
  position: 'absolute',
  margin: 0,
  fontFamily: FONT_HEADLINE,
  color: '#fff',
  textShadow: '0 3px 14px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.6)',
  pointerEvents: 'none',
}

/**
 * Renderizador genérico de plantillas de noticia basadas en un marco PNG.
 *
 * Estructura de capas (de abajo hacia arriba):
 *   1. Fotografía principal (full-bleed, object-fit: cover) — ARRASTRABLE.
 *   2. Marco PNG con todo el diseño fijo (transparente donde va la foto).
 *   3. Badge de categoría (editable) que cubre el badge del marco.
 *   4. Titular editable.
 *
 * Las plantillas de noticia reutilizan este componente; solo cambian el `layout`
 * y el tamaño.
 */
const ZOOM_MIN = 0.5
const ZOOM_MAX = 5

export default function NewsFrameTemplate({
  data,
  layout,
  imagePosition,
  onPositionChange,
  resizeMode = false,
  foreground,
  onForegroundChange,
  headlineScale = 1,
}: NewsFrameTemplateProps) {
  const { badge, headline } = layout
  const category = data.category.trim() || 'CATEGORÍA'
  const headlineText = data.headline.trim() || 'Escribe aquí el titular de la noticia.'


  const pos = imagePosition ?? { x: 50, y: 50 }
  const fg = foreground ?? { zoom: 1, x: 0, y: 0 }
  const rootRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const fgRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  // En modo Redimensionar la imagen se muestra completa (contain), así que no se arrastra.
  const draggable = Boolean(onPositionChange && data.imageUrl && !resizeMode)

  // ---- Primer plano (modo Redimensionar): arrastrar + ampliar ----
  const fgDragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const [fgDragging, setFgDragging] = useState(false)
  // Valores actuales para el listener de rueda (evita closure obsoleto).
  const fgValsRef = useRef(fg)
  fgValsRef.current = fg

  const onFgPointerDown = (e: ReactPointerEvent<HTMLImageElement>) => {
    if (!onForegroundChange) return
    e.currentTarget.setPointerCapture(e.pointerId)
    fgDragRef.current = { x: e.clientX, y: e.clientY, tx: fg.x, ty: fg.y }
    setFgDragging(true)
  }
  const onFgPointerMove = (e: ReactPointerEvent<HTMLImageElement>) => {
    const d = fgDragRef.current
    const root = rootRef.current
    if (!d || !root || !onForegroundChange) return
    const rect = root.getBoundingClientRect()
    const dx = ((e.clientX - d.x) / rect.width) * 100
    const dy = ((e.clientY - d.y) / rect.height) * 100
    onForegroundChange({
      zoom: fg.zoom,
      x: clamp(d.tx + dx, -200, 200),
      y: clamp(d.ty + dy, -200, 200),
    })
  }
  const onFgPointerUp = (e: ReactPointerEvent<HTMLImageElement>) => {
    fgDragRef.current = null
    setFgDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  // Rueda del mouse para ampliar (listener nativo no-pasivo para poder preventDefault).
  useEffect(() => {
    const el = fgRef.current
    if (!el || !resizeMode || !onForegroundChange) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const cur = fgValsRef.current
      const zoom = clamp(cur.zoom * Math.exp(-e.deltaY * 0.0015), ZOOM_MIN, ZOOM_MAX)
      onForegroundChange({ ...cur, zoom })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [resizeMode, onForegroundChange])

  const onPointerDown = (e: ReactPointerEvent<HTMLImageElement>) => {
    if (!draggable) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
    setDragging(true)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLImageElement>) => {
    const d = dragRef.current
    const img = imgRef.current
    if (!d || !img || !onPositionChange) return
    const rect = img.getBoundingClientRect()
    const nW = img.naturalWidth
    const nH = img.naturalHeight
    if (!nW || !nH) return
    // object-fit: cover → escala y desbordamiento (en px de pantalla, escala del preview incluida)
    const s = Math.max(rect.width / nW, rect.height / nH)
    const overflowX = nW * s - rect.width
    const overflowY = nH * s - rect.height
    let x = d.px
    let y = d.py
    if (overflowX > 0) x = clamp(d.px - ((e.clientX - d.x) / overflowX) * 100, 0, 100)
    if (overflowY > 0) y = clamp(d.py - ((e.clientY - d.y) / overflowY) * 100, 0, 100)
    onPositionChange({ x, y })
  }

  const endDrag = (e: ReactPointerEvent<HTMLImageElement>) => {
    dragRef.current = null
    setDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  return (
    <div ref={rootRef} style={ROOT_STYLE}>
      {/* 1. Fotografía principal */}
      {data.imageUrl ? (
        resizeMode ? (
          // Modo Redimensionar: fondo desenfocado (cover) + imagen nítida completa (contain).
          <>
            <img
              src={data.imageUrl}
              alt=""
              aria-hidden
              draggable={false}
              style={{ ...BLUR_BG_STYLE, objectPosition: `${pos.x}% ${pos.y}%` }}
            />
            <img
              ref={fgRef}
              src={data.imageUrl}
              alt=""
              draggable={false}
              onPointerDown={onFgPointerDown}
              onPointerMove={onFgPointerMove}
              onPointerUp={onFgPointerUp}
              onPointerCancel={onFgPointerUp}
              style={{
                ...FG_BASE_STYLE,
                transform: `translate(${fg.x}%, ${fg.y}%) scale(${fg.zoom})`,
                cursor: onForegroundChange ? (fgDragging ? 'grabbing' : 'grab') : 'default',
              }}
            />
          </>
        ) : (
          <img
            ref={imgRef}
            src={data.imageUrl}
            alt=""
            draggable={false}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              ...COVER_BASE_STYLE,
              objectPosition: `${pos.x}% ${pos.y}%`,
              cursor: draggable ? (dragging ? 'grabbing' : 'grab') : 'default',
            }}
          />
        )
      ) : (
        <div style={PLACEHOLDER_STYLE}>Sube una imagen</div>
      )}

      {/* 2. Marco fijo */}
      <img src={layout.frameSrc} alt="" style={FRAME_STYLE} />

      {/* 3. Badge de categoría: rectángulo con esquinas opuestas redondeadas,
             gradiente rojo→negro (60/40) y borde blanco. */}
      <div
        style={{
          ...BADGE_BASE_STYLE,
          left: badge.left,
          top: badge.top,
          minWidth: badge.minWidth,
          height: badge.height,
          paddingLeft: badge.paddingX,
          paddingRight: badge.paddingX,
          borderRadius: badge.borderRadius,
          background: badge.background ?? BADGE_BASE_STYLE.background,
          border: badge.border ?? BADGE_BASE_STYLE.border,
        }}
      >
        <span
          style={{
            ...BADGE_TEXT_STYLE,
            fontWeight: badge.fontWeight ?? BADGE_TEXT_STYLE.fontWeight,
            fontSize: badge.fontSize,
            color: badge.color ?? BADGE_TEXT_STYLE.color,
            WebkitTextStroke: badge.textStroke,
          }}
        >
          {category}
        </span>
      </div>

      {/* 4. Titular */}
      <h1
        style={{
          ...HEADLINE_BASE_STYLE,
          left: headline.left,
          top: headline.top,
          right: headline.right,
          fontWeight: headline.fontWeight,
          fontSize: headline.fontSize * headlineScale,
          lineHeight: `${headline.lineHeight * headlineScale}px`,
          textAlign: headline.textAlign,
          color: headline.color ?? HEADLINE_BASE_STYLE.color,
          background: headline.background,
          padding: `${headline.paddingY ?? 0}px ${headline.paddingX ?? 0}px`,
        }}
      >
        {headlineText}
      </h1>
    </div>
  )
}
