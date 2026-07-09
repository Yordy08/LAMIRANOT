import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useFitScale } from '../hooks/useFitScale'
import reelFrameSrc from '../assets/reels-frame.png'

const REEL_SIZE = { width: 1080, height: 1920 }
const FONT_HEADLINE =
  "'Arial Black', Arial, Helvetica, system-ui, sans-serif"
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const TIMELINE_TICKS = Array.from({ length: 18 }, (_, index) => `tick-${index}`)

export interface VideoTemplateConfig {
  title: string
  frameSrc: string
  size: { width: number; height: number }
  exportFileName: string
  initialHeadline: string
  placeholder: string
  badge: {
    left: number
    top: number
    minWidth: number
    height: number
    paddingX: number
    fontSize: number
    fontWeight?: number
    background?: string
    color?: string
    border?: string
    radius?: number
    shadow?: string
    textShadow?: string
    underFrame?: boolean
    backgroundLeft?: number
    backgroundWidth?: number
    textStrokeColor?: string
    textStrokeWidth?: number
  }
  headlineBox: { left: number; top: number; width: number; minHeight: number; paddingX: number; paddingY: number; radius: number }
  headlineBg: string
  headlineFitContent?: boolean
  headlineWeight?: number
  headlineSize: { initial: number; min: number; max: number }
  videoBox?: { left: number; top: number; width: number; height: number; radius?: number }
}

const reelConfig: VideoTemplateConfig = {
  title: 'Reels',
  frameSrc: reelFrameSrc,
  size: REEL_SIZE,
  exportFileName: 'lamira-noticiosa-reels.webm',
  initialHeadline: 'Aqui titular ejemplo',
  placeholder: 'Sube un video',
  badge: {
    left: 208,
    top: 1169,
    minWidth: 444,
    height: 94,
    paddingX: 32,
    fontSize: 58,
    background: '#fff',
    color: '#000',
    border: 'none',
    radius: 18,
    shadow: 'none',
    textShadow: 'none',
    underFrame: true,
    backgroundLeft: 125,
    backgroundWidth: 525,
  },
  headlineBox: { left: 211, top: 1278, width: 680, minHeight: 64, paddingX: 8, paddingY: 4, radius: 0 },
  headlineBg: '#c90018',
  headlineFitContent: true,
  headlineSize: { initial: 48, min: 34, max: 68 },
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la plantilla.'))
    img.src = src
  })

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function drawBadgeShape(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next
    } else {
      lines.push(line)
      line = word
    }
  }

  if (line) lines.push(line)
  return lines
}

function getWrappedTextLines(text: string, font: string, maxWidth: number) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return [text]
  ctx.font = font
  return wrapText(ctx, text, maxWidth)
}

interface SourceVideoInfo {
  type: string
  extension: string
}

function getVideoExtension(fileName: string, mimeType: string) {
  const fromName = fileName.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()
  if (fromName) return fromName
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('webm')) return 'webm'
  return 'webm'
}

function getVideoExportFormat(source?: SourceVideoInfo | null) {
  const sourceIsMp4 = source?.type.includes('mp4') || source?.extension === 'mp4'
  const sourceIsWebm = source?.type.includes('webm') || source?.extension === 'webm'
  const sourceCandidates = sourceIsMp4
    ? [
        { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' },
        { mimeType: 'video/mp4;codecs=h264,aac', extension: 'mp4' },
        { mimeType: 'video/mp4', extension: 'mp4' },
      ]
    : sourceIsWebm
      ? [
          { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
          { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
          { mimeType: 'video/webm', extension: 'webm' },
        ]
      : []

  const candidates = [
    ...sourceCandidates,
    { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
  ]
  const supported = candidates.find(({ mimeType }) => MediaRecorder.isTypeSupported(mimeType))
  if (supported) return supported
  return {
    mimeType: '',
    extension: source?.extension ?? 'webm',
  }
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function VideoReelEditor({ config = reelConfig }: { config?: VideoTemplateConfig }) {
  const { badge, headlineBox, size } = config
  const videoBox = config.videoBox ?? { left: 0, top: 0, width: size.width, height: size.height, radius: 0 }
  const videoAboveFrame = Boolean(config.videoBox)
  const [category, setCategory] = useState('Categoría')
  const [headline, setHeadline] = useState(config.initialHeadline)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [previewTime, setPreviewTime] = useState(0)
  const [moveVideoMode, setMoveVideoMode] = useState(false)
  const [videoOffset, setVideoOffset] = useState({ x: 0, y: 0 })
  const draggingTrimRef = useRef<'start' | 'end' | null>(null)
  const [headlineSize, setHeadlineSize] = useState(config.headlineSize.initial)
  const [videoScale, setVideoScale] = useState(100)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportError, setExportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sourceVideoInfoRef = useRef<SourceVideoInfo | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const videoDragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const { containerRef, scale } = useFitScale(size)

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

  const handleVideo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const nextUrl = URL.createObjectURL(file)
    sourceVideoInfoRef.current = { type: file.type, extension: getVideoExtension(file.name, file.type) }
    setVideoDuration(0)
    setTrimStart(0)
    setTrimEnd(0)
    setVideoUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return nextUrl
    })
  }

  const handlePreviewMetadata = () => {
    const video = previewVideoRef.current
    if (!video || !Number.isFinite(video.duration)) return
    setVideoDuration(video.duration)
    setTrimStart(0)
    setTrimEnd(video.duration)
  }

  const handlePreviewTimeUpdate = () => {
    const video = previewVideoRef.current
    if (!video || !trimEnd) return
    setPreviewTime(video.currentTime)
    if (video.currentTime < trimStart) video.currentTime = trimStart
    if (video.currentTime >= trimEnd) {
      video.currentTime = trimStart
      setPreviewTime(trimStart)
      if (!video.paused) void video.play()
    }
  }

  const updateTrimStart = (value: number) => {
    const next = Math.min(value, Math.max(0, trimEnd - 0.1))
    setTrimStart(next)
    setPreviewTime(next)
    const video = previewVideoRef.current
    if (video) video.currentTime = next
  }

  const updateTrimEnd = (value: number) => {
    const next = Math.max(value, trimStart + 0.1)
    setTrimEnd(next)
    const video = previewVideoRef.current
    if (video && video.currentTime > next) video.currentTime = trimStart
  }

  const getTimeFromPointer = (e: ReactPointerEvent) => {
    const node = timelineRef.current
    if (!node || !videoDuration) return 0
    const rect = node.getBoundingClientRect()
    const pct = clamp((e.clientX - rect.left) / rect.width, 0, 1)
    return pct * videoDuration
  }

  const startTrimDrag = (type: 'start' | 'end', e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingTrimRef.current = type
  }

  const moveTrimDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const draggingTrim = draggingTrimRef.current
    if (!draggingTrim) return
    const time = getTimeFromPointer(e)
    if (draggingTrim === 'start') updateTrimStart(time)
    else updateTrimEnd(time)
  }

  const endTrimDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingTrimRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  const startVideoDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!moveVideoMode) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    videoDragRef.current = { x: e.clientX, y: e.clientY, ox: videoOffset.x, oy: videoOffset.y }
  }

  const moveVideoDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = videoDragRef.current
    if (!drag) return
    setVideoOffset({
      x: drag.ox + (e.clientX - drag.x) / scale,
      y: drag.oy + (e.clientY - drag.y) / scale,
    })
  }

  const endVideoDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    videoDragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  const labelClass = 'mb-2 block text-sm font-semibold uppercase tracking-wide text-slate-300'
  const fieldClass =
    'w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 ' +
    'outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/40'

  const displayCategory = category.trim() || 'CATEGORÍA'
  const displayHeadline = headline.trim() || 'Escribe aquí el titular del video.'
  const headlineLineHeight = headlineSize * 0.92
  const headlineFont = `${config.headlineWeight ?? 800} ${headlineSize}px ${FONT_HEADLINE}`
  const headlineLines = getWrappedTextLines(
    displayHeadline,
    headlineFont,
    headlineBox.width - headlineBox.paddingX * 2,
  )
  const headlineVisualHeight = Math.max(
    headlineBox.minHeight,
    headlineLines.length * headlineLineHeight + headlineBox.paddingY * 2,
  )
  const trimStartPct = videoDuration ? (trimStart / videoDuration) * 100 : 0
  const trimEndPct = videoDuration ? (trimEnd / videoDuration) * 100 : 100
  const playheadPct = videoDuration ? (previewTime / videoDuration) * 100 : 0

  const exportVideo = async () => {
    if (!videoUrl || isExporting) return
    if (!('MediaRecorder' in window)) {
      setExportError('Tu navegador no soporta exportación de video.')
      return
    }

    setIsExporting(true)
    setExportProgress(0)
    setExportError(null)

    const sourceVideo = document.createElement('video')
    sourceVideo.src = videoUrl
    sourceVideo.muted = false
    sourceVideo.playsInline = true
    sourceVideo.crossOrigin = 'anonymous'
    sourceVideo.preload = 'auto'
    let audioContext: AudioContext | null = null

    try {
      const frame = await loadImage(config.frameSrc)
      if (document.fonts?.ready) await document.fonts.ready

      await new Promise<void>((resolve, reject) => {
        if (sourceVideo.readyState >= 1) {
          resolve()
          return
        }
        sourceVideo.onloadedmetadata = () => resolve()
        sourceVideo.onerror = () => reject(new Error('No se pudo cargar el video.'))
      })

      const exportStart = Math.max(0, Math.min(trimStart, sourceVideo.duration || 0))
      const exportEnd = Math.min(trimEnd || sourceVideo.duration, sourceVideo.duration)
      if (!exportEnd || exportEnd <= exportStart) {
        throw new Error('Selecciona un rango válido para exportar.')
      }

      const canvas = document.createElement('canvas')
      canvas.width = size.width
      canvas.height = size.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No se pudo preparar el lienzo de exportación.')

      const stream = canvas.captureStream(30)
      audioContext = new AudioContext()
      const audioSource = audioContext.createMediaElementSource(sourceVideo)
      const audioDestination = audioContext.createMediaStreamDestination()
      audioSource.connect(audioDestination)
      audioDestination.stream.getAudioTracks().forEach((track) => stream.addTrack(track))
      await audioContext.resume()

      const { mimeType, extension } = getVideoExportFormat(sourceVideoInfoRef.current)
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: size.height >= 1800 ? 12_000_000 : 9_000_000,
        audioBitsPerSecond: 192_000,
      })
      const chunks: Blob[] = []
      let lastProgress = -1

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }

      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType || 'video/webm' }))
        recorder.onerror = () => reject(new Error('No se pudo exportar el video.'))
      })

      const drawFrame = () => {
        ctx.clearRect(0, 0, size.width, size.height)
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, size.width, size.height)

        const drawVideo = () => {
          const zoom = videoScale / 100
          const sourceWidth = sourceVideo.videoWidth || videoBox.width
          const sourceHeight = sourceVideo.videoHeight || videoBox.height
          const fitMode = moveVideoMode ? Math.min : Math.max
          const fit = fitMode(videoBox.width / sourceWidth, videoBox.height / sourceHeight) * zoom
          const drawWidth = sourceWidth * fit
          const drawHeight = sourceHeight * fit
          ctx.save()
          drawRoundedRect(ctx, videoBox.left, videoBox.top, videoBox.width, videoBox.height, videoBox.radius ?? 0)
          ctx.clip()
          ctx.drawImage(
            sourceVideo,
            videoBox.left + (videoBox.width - drawWidth) / 2 + videoOffset.x,
            videoBox.top + (videoBox.height - drawHeight) / 2 + videoOffset.y,
            drawWidth,
            drawHeight,
          )
          ctx.restore()
        }

        ctx.font = `${badge.fontWeight ?? 800} ${badge.fontSize}px ${FONT_HEADLINE}`
        const badgeWidth = Math.max(badge.minWidth, ctx.measureText(displayCategory).width + badge.paddingX * 2)
        const drawBadgeBackground = () => {
          ctx.fillStyle = badge.background ?? '#d0202c'
          drawBadgeShape(
            ctx,
            badge.backgroundLeft ?? badge.left,
            badge.top,
            badge.backgroundWidth ?? badgeWidth,
            badge.height,
            badge.radius ?? 16,
          )
          ctx.fill()
          if (badge.border !== 'none') {
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 2
            ctx.stroke()
          }
        }

        if (!videoAboveFrame) drawVideo()
        if (badge.underFrame) drawBadgeBackground()
        ctx.drawImage(frame, 0, 0, size.width, size.height)
        if (videoAboveFrame) drawVideo()
        if (!badge.underFrame) drawBadgeBackground()

        ctx.fillStyle = badge.color ?? '#fff'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = badge.textShadow === 'none' ? 'transparent' : 'rgba(0,0,0,0.45)'
        ctx.shadowBlur = badge.textShadow === 'none' ? 0 : 3
        ctx.shadowOffsetY = badge.textShadow === 'none' ? 0 : 2
        const categoryText = displayCategory.toUpperCase()
        const categoryX = badge.left + (badgeWidth - ctx.measureText(categoryText).width) / 2
        const categoryY = badge.top + badge.height / 2
        if (badge.textStrokeColor && badge.textStrokeWidth) {
          ctx.lineWidth = badge.textStrokeWidth
          ctx.strokeStyle = badge.textStrokeColor
          ctx.strokeText(categoryText, categoryX, categoryY)
        }
        ctx.fillText(categoryText, categoryX, categoryY)

        ctx.font = headlineFont
        ctx.textBaseline = 'top'
        ctx.textAlign = 'center'
        ctx.shadowColor = 'rgba(0,0,0,0.65)'
        ctx.shadowBlur = 14
        ctx.shadowOffsetY = 3
        const centerX = headlineBox.left + headlineBox.width / 2
        headlineLines.forEach((line, index) => {
          const lineTop = headlineBox.top + index * headlineLineHeight
          const textY = lineTop + headlineBox.paddingY
          const lineWidth = ctx.measureText(line).width

          ctx.shadowColor = 'transparent'
          ctx.fillStyle = config.headlineBg
          const bgLeft = config.headlineFitContent
            ? centerX - (lineWidth + headlineBox.paddingX * 2) / 2
            : headlineBox.left
          const bgWidth = config.headlineFitContent
            ? lineWidth + headlineBox.paddingX * 2
            : headlineBox.width
          drawRoundedRect(ctx, bgLeft, lineTop, bgWidth, headlineLineHeight + headlineBox.paddingY * 2, headlineBox.radius)
          ctx.fill()

          ctx.fillStyle = '#fff'
          ctx.shadowColor = 'rgba(0,0,0,0.65)'
          ctx.fillText(line, centerX, textY)
        })
      }

      await new Promise<void>((resolve) => {
        if (Math.abs(sourceVideo.currentTime - exportStart) < 0.05) {
          resolve()
          return
        }
        sourceVideo.onseeked = () => resolve()
        sourceVideo.currentTime = exportStart
      })
      await sourceVideo.play()
      recorder.start()

      await new Promise<void>((resolve) => {
        const render = () => {
          drawFrame()
          const segmentDuration = exportEnd - exportStart
          if (segmentDuration > 0) {
            const nextProgress = Math.min(99, Math.round(((sourceVideo.currentTime - exportStart) / segmentDuration) * 100))
            if (nextProgress !== lastProgress) {
              lastProgress = nextProgress
              setExportProgress(nextProgress)
            }
          }
          if (sourceVideo.ended || sourceVideo.currentTime >= exportEnd) {
            sourceVideo.pause()
            resolve()
            return
          }
          requestAnimationFrame(render)
        }
        render()
      })

      recorder.stop()
      const blob = await finished
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = config.exportFileName.replace(/\.[^.]+$/, `.${extension}`)
      link.click()
      URL.revokeObjectURL(url)
      setExportProgress(100)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'No se pudo exportar el video.')
    } finally {
      sourceVideo.pause()
      await audioContext?.close()
      setIsExporting(false)
    }
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      <aside className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="mb-1 text-xl font-bold text-white">{config.title}</h2>
        <p className="mb-6 text-sm text-slate-400">
          {size.width} × {size.height} px
        </p>

        <div className="flex flex-col gap-6">
          <div>
            <label htmlFor="video-category" className={labelClass}>
              Categoría
            </label>
            <input
              id="video-category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej: ÚLTIMA HORA"
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="video-headline" className={labelClass}>
              Titular
            </label>
            <textarea
              id="video-headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Escribe aquí el titular del video…"
              rows={4}
              className={`${fieldClass} resize-none`}
            />
          </div>

          <div>
            <span className={labelClass}>Video vertical</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideo}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-slate-600 bg-slate-900/60 px-4 py-3 text-slate-200 transition hover:border-red-500 hover:text-white"
            >
              {videoUrl ? 'Cambiar video' : 'Subir video'}
            </button>
          </div>

          <div>
            <label htmlFor="headline-size" className={labelClass}>
              Tamaño del titular: {headlineSize}px
            </label>
            <input
              id="headline-size"
              type="range"
              min={config.headlineSize.min}
              max={config.headlineSize.max}
              value={headlineSize}
              onChange={(e) => setHeadlineSize(Number(e.target.value))}
              className="w-full accent-red-600"
            />
          </div>

          <div>
            <label htmlFor="video-scale" className={labelClass}>
              Redimensionar video: {videoScale}%
            </label>
            <input
              id="video-scale"
              type="range"
              min="100"
              max="170"
              value={videoScale}
              onChange={(e) => setVideoScale(Number(e.target.value))}
              className="w-full accent-red-600"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setMoveVideoMode((active) => !active)}
              aria-pressed={moveVideoMode}
              disabled={!videoUrl}
              className={
                'flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ' +
                (moveVideoMode
                  ? 'border-red-500 bg-red-600/20 text-white'
                  : 'border-slate-600 bg-slate-900/60 text-slate-200 hover:border-red-500 hover:text-white')
              }
            >
              <span
                className={
                  'inline-block h-2.5 w-2.5 rounded-full ' +
                  (moveVideoMode ? 'bg-red-500' : 'bg-slate-500')
                }
              />
              Redimensionar
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Activa esta opción y arrastra el video en la previsualización para moverlo y recortarlo.
            </p>
            {videoUrl && (
              <button
                type="button"
                onClick={() => setVideoOffset({ x: 0, y: 0 })}
                className="mt-2 text-xs text-slate-400 underline-offset-2 transition hover:text-white hover:underline"
              >
                Centrar video
              </button>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={exportVideo}
              disabled={!videoUrl || isExporting}
              className="w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExporting ? 'Exportando video…' : 'Exportar video'}
            </button>
            {exportError && <p className="mt-2 text-sm text-red-400">{exportError}</p>}
            {isExporting && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span>Progreso</span>
                  <span>{exportProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-red-600 transition-all" style={{ width: `${exportProgress}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <section className="min-h-[60vh] rounded-2xl border border-slate-800 bg-slate-950/60 lg:min-h-0">
        <div ref={containerRef} className="flex h-full w-full items-center justify-center overflow-hidden p-4">
          <div className="flex flex-col items-center gap-3">
            <div
              className="shadow-2xl shadow-black/50"
              style={{ width: size.width * scale, height: size.height * scale }}
            >
              <div
                className="relative overflow-hidden bg-black"
                style={{
                  width: size.width,
                  height: size.height,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
              {!videoUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-black text-center text-4xl font-semibold uppercase tracking-[0.25em] text-white/30">
                  {config.placeholder}
                </div>
              )}

              {videoUrl && !videoAboveFrame && !moveVideoMode && (
                <video
                  ref={previewVideoRef}
                  src={videoUrl}
                  controls
                  autoPlay
                  playsInline
                  onLoadedMetadata={handlePreviewMetadata}
                  onTimeUpdate={handlePreviewTimeUpdate}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: `scale(${videoScale / 100})`,
                    transformOrigin: 'center',
                  }}
                />
              )}

              {videoUrl && !videoAboveFrame && moveVideoMode && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                    background: '#000',
                    cursor: 'grab',
                    touchAction: 'none',
                  }}
                  onPointerDown={startVideoDrag}
                  onPointerMove={moveVideoDrag}
                  onPointerUp={endVideoDrag}
                  onPointerCancel={endVideoDrag}
                >
                  <video
                    ref={previewVideoRef}
                    src={videoUrl}
                    controls
                    autoPlay
                    playsInline
                    onLoadedMetadata={handlePreviewMetadata}
                    onTimeUpdate={handlePreviewTimeUpdate}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      transform: `translate(${videoOffset.x}px, ${videoOffset.y}px) scale(${videoScale / 100})`,
                      transformOrigin: 'center',
                    }}
                  />
                </div>
              )}

              {badge.underFrame && (
                <div
                  style={{
                    position: 'absolute',
                    left: badge.backgroundLeft ?? badge.left,
                    top: badge.top,
                    width: badge.backgroundWidth ?? badge.minWidth,
                    height: badge.height,
                    borderRadius: badge.radius ?? 16,
                    border: badge.border ?? '2px solid #ffffff',
                    background: badge.background ?? 'linear-gradient(90deg, #d0202c 0%, #c11a26 45%, #2c0510 76%, #050102 100%)',
                    boxShadow: badge.shadow ?? '0 6px 14px rgba(0,0,0,0.45)',
                    pointerEvents: 'none',
                  }}
                />
              )}

              <img
                src={config.frameSrc}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
              />

              {videoUrl && videoAboveFrame && (
                <div
                  style={{
                    position: 'absolute',
                    left: videoBox.left,
                    top: videoBox.top,
                    width: videoBox.width,
                    height: videoBox.height,
                    overflow: 'hidden',
                    borderRadius: videoBox.radius ?? 0,
                    background: '#000',
                    cursor: moveVideoMode ? 'grab' : 'default',
                    touchAction: moveVideoMode ? 'none' : 'auto',
                  }}
                  onPointerDown={startVideoDrag}
                  onPointerMove={moveVideoDrag}
                  onPointerUp={endVideoDrag}
                  onPointerCancel={endVideoDrag}
                >
                  <video
                    ref={previewVideoRef}
                    src={videoUrl}
                    controls
                    autoPlay
                    playsInline
                    onLoadedMetadata={handlePreviewMetadata}
                    onTimeUpdate={handlePreviewTimeUpdate}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: `translate(${videoOffset.x}px, ${videoOffset.y}px) scale(${videoScale / 100})`,
                      transformOrigin: 'center',
                    }}
                  />
                </div>
              )}

              <div
                style={{
                  position: 'absolute',
                  left: badge.left,
                  top: badge.top,
                  minWidth: badge.minWidth,
                  height: badge.height,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingLeft: badge.paddingX,
                  paddingRight: badge.paddingX,
                  boxSizing: 'border-box',
                  borderRadius: badge.radius ?? 16,
                  border: badge.underFrame ? 'none' : badge.border ?? '2px solid #ffffff',
                  background: badge.underFrame ? 'transparent' : badge.background ?? 'linear-gradient(90deg, #d0202c 0%, #c11a26 45%, #2c0510 76%, #050102 100%)',
                  boxShadow: badge.underFrame ? 'none' : badge.shadow ?? '0 6px 14px rgba(0,0,0,0.45)',
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    fontFamily: FONT_HEADLINE,
                    fontWeight: badge.fontWeight ?? 800,
                    fontSize: badge.fontSize,
                    lineHeight: 1,
                    letterSpacing: 1,
                    color: badge.color ?? '#fff',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    textShadow: badge.textShadow ?? '0 2px 3px rgba(0,0,0,0.45)',
                    WebkitTextStroke: badge.textStrokeColor && badge.textStrokeWidth ? `${badge.textStrokeWidth}px ${badge.textStrokeColor}` : undefined,
                  }}
                >
                  {displayCategory}
                </span>
              </div>

              <h1
                style={{
                  position: 'absolute',
                  left: headlineBox.left,
                  top: headlineBox.top,
                  width: headlineBox.width,
                  height: headlineVisualHeight,
                  margin: 0,
                  padding: `${headlineBox.paddingY}px ${headlineBox.paddingX}px`,
                  borderRadius: headlineBox.radius,
                  boxSizing: 'border-box',
                  background: config.headlineFitContent ? 'transparent' : config.headlineBg,
                  fontFamily: FONT_HEADLINE,
                  fontWeight: config.headlineWeight ?? 800,
                  fontSize: headlineSize,
                  lineHeight: `${headlineLineHeight}px`,
                  color: '#fff',
                  textAlign: 'center',
                  textShadow: '0 3px 14px rgba(0,0,0,0.65), 0 1px 2px rgba(0,0,0,0.6)',
                  pointerEvents: 'none',
                }}
              >
                {headlineLines.map((line) => (
                  <span
                    key={line}
                    style={{
                      display: 'table',
                      margin: '0 auto',
                      background: config.headlineFitContent ? config.headlineBg : 'transparent',
                      padding: config.headlineFitContent ? `0 ${headlineBox.paddingX}px` : 0,
                    }}
                  >
                    {line}
                  </span>
                ))}
              </h1>
              </div>
            </div>

            {videoUrl && (
              <div className="w-full rounded-2xl border border-slate-800 bg-slate-950/90 p-4 shadow-xl shadow-black/40">
                <div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-300">
                  <span>Recorte del video</span>
                  <span>{formatTime(Math.max(0, trimEnd - trimStart))}</span>
                </div>

                <div
                  ref={timelineRef}
                  className="relative h-16 touch-none overflow-hidden rounded-xl border border-slate-700 bg-slate-900 px-2"
                  onPointerMove={moveTrimDrag}
                  onPointerUp={endTrimDrag}
                  onPointerCancel={endTrimDrag}
                >
                  <div className="absolute inset-x-2 top-1/2 h-8 -translate-y-1/2 overflow-hidden rounded-lg bg-slate-800">
                    <div className="flex h-full w-full">
                      {TIMELINE_TICKS.map((tick) => (
                        <div
                          key={tick}
                          className="mx-px flex-1 rounded-sm bg-gradient-to-b from-slate-500/70 via-slate-700/70 to-slate-500/70"
                        />
                      ))}
                    </div>
                  </div>

                  <div
                    className="absolute top-1/2 h-10 -translate-y-1/2 rounded-md border-2 border-red-500 bg-red-600/15 shadow-[0_0_0_999px_rgba(2,6,23,0.58)]"
                    style={{ left: `${trimStartPct}%`, right: `${100 - trimEndPct}%` }}
                  />

                  <div
                    className="pointer-events-none absolute bottom-1 top-1 w-0.5 rounded-full bg-white shadow-lg"
                    style={{ left: `${playheadPct}%` }}
                  />

                  <div
                    className="absolute top-1/2 z-10 flex h-12 w-6 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-md border-2 border-red-500 bg-red-600 shadow-lg"
                    style={{ left: `${trimStartPct}%` }}
                    onPointerDown={(e) => startTrimDrag('start', e)}
                  >
                    <span className="h-6 w-0.5 rounded bg-white/80" />
                  </div>
                  <div
                    className="absolute top-1/2 z-10 flex h-12 w-6 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-md border-2 border-red-500 bg-red-600 shadow-lg"
                    style={{ left: `${trimEndPct}%` }}
                    onPointerDown={(e) => startTrimDrag('end', e)}
                  >
                    <span className="h-6 w-0.5 rounded bg-white/80" />
                  </div>
                </div>

                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>Inicio: {formatTime(trimStart)}</span>
                  <span>Fin: {formatTime(trimEnd)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
