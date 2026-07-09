import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import type { NewsTemplateData } from '../types'

interface EditorFormProps {
  data: NewsTemplateData
  onCategoryChange: (value: string) => void
  onHeadlineChange: (value: string) => void
  headlineScale: number
  onHeadlineScaleChange: (scale: number) => void
  onImageChange: (file: File | null) => void
  onExport: () => void
  isExporting: boolean
  exportError?: string | null
  resizeMode: boolean
  onToggleResize: () => void
  zoom: number
  onZoomChange: (zoom: number) => void
  onResetForeground: () => void
  fbStatus: { connected: boolean; pageName?: string } | null
  fbPublishing: boolean
  fbError: string | null
  fbSuccess: boolean
  onConnectFacebook: () => void
  onPublishToFb: () => void
  onClearFbSuccess: () => void
  onClearFbError: () => void
}

/**
 * Formulario del panel izquierdo. Es genérico respecto a la plantilla:
 * solo edita categoría, titular e imagen, y dispara la exportación.
 */
export default function EditorForm({
  data,
  onCategoryChange,
  onHeadlineChange,
  headlineScale,
  onHeadlineScaleChange,
  onImageChange,
  onExport,
  isExporting,
  exportError,
  resizeMode,
  onToggleResize,
  zoom,
  onZoomChange,
  onResetForeground,
  fbStatus,
  fbPublishing,
  fbError,
  fbSuccess,
  onConnectFacebook,
  onPublishToFb,
  onClearFbSuccess,
  onClearFbError,
}: EditorFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDraggingImage, setIsDraggingImage] = useState(false)

  const applyImageFile = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    onImageChange(file)
  }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    applyImageFile(e.target.files?.[0] ?? null)
  }

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setIsDraggingImage(false)
    applyImageFile(e.dataTransfer.files?.[0] ?? null)
  }

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((clipboardItem) =>
        clipboardItem.type.startsWith('image/'),
      )
      if (!item) return
      const file = item.getAsFile()
      if (!file) return
      e.preventDefault()
      onImageChange(file)
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [onImageChange])

  const labelClass = 'mb-2 block text-sm font-semibold uppercase tracking-wide text-slate-300'
  const fieldClass =
    'w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 ' +
    'outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/40'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label htmlFor="category" className={labelClass}>
          Categoría
        </label>
        <input
          id="category"
          type="text"
          value={data.category}
          onChange={(e) => onCategoryChange(e.target.value)}
          placeholder="Ej: ÚLTIMA HORA"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="headline" className={labelClass}>
          Titular
        </label>
        <textarea
          id="headline"
          value={data.headline}
          onChange={(e) => onHeadlineChange(e.target.value)}
          placeholder="Escribe aquí el titular de la noticia…"
          rows={4}
          className={`${fieldClass} resize-none`}
        />

        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-300">Tamaño del titular</span>
            <div className="flex items-center gap-3">
              <span className="text-xs tabular-nums text-slate-400">
                {Math.round(headlineScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => onHeadlineScaleChange(1)}
                className="text-xs text-slate-400 underline-offset-2 transition hover:text-white hover:underline"
              >
                Restablecer
              </button>
            </div>
          </div>
          <input
            type="range"
            aria-label="Tamaño del titular"
            min={0.5}
            max={1.8}
            step={0.01}
            value={headlineScale}
            onChange={(e) => onHeadlineScaleChange(Number(e.target.value))}
            className="w-full accent-red-600"
          />
        </div>
      </div>

      <div>
        <span className={labelClass}>Imagen principal</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault()
            setIsDraggingImage(true)
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setIsDraggingImage(false)}
          onDrop={handleDrop}
          className={
            'w-full rounded-lg border border-dashed px-4 py-4 text-slate-200 transition hover:border-red-500 hover:text-white ' +
            (isDraggingImage
              ? 'border-red-500 bg-red-600/20 text-white'
              : 'border-slate-600 bg-slate-900/60')
          }
        >
          {isDraggingImage
            ? 'Suelta la imagen aquí'
            : data.imageUrl
              ? 'Cambiar imagen, arrastrar o pegar'
              : 'Subir, arrastrar o pegar imagen'}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          También puedes arrastrar una imagen al botón o pegarla con Ctrl+V.
        </p>

        <button
          type="button"
          onClick={onToggleResize}
          aria-pressed={resizeMode}
          className={
            'mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium transition ' +
            (resizeMode
              ? 'border-red-500 bg-red-600/20 text-white'
              : 'border-slate-600 bg-slate-900/60 text-slate-200 hover:border-red-500 hover:text-white')
          }
        >
          <span
            className={
              'inline-block h-2.5 w-2.5 rounded-full ' +
              (resizeMode ? 'bg-red-500' : 'bg-slate-500')
            }
          />
          Redimensionar
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Ajusta la imagen al formato con fondo desenfocado. Luego puedes ampliar, mover y
          recortar la imagen del frente.
        </p>

        {resizeMode && data.imageUrl && (
          <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">Zoom</span>
              <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums text-slate-400">{zoom.toFixed(2)}×</span>
                <button
                  type="button"
                  onClick={onResetForeground}
                  className="text-xs text-slate-400 underline-offset-2 transition hover:text-white hover:underline"
                >
                  Restablecer
                </button>
              </div>
            </div>
            <input
              type="range"
              aria-label="Zoom de la imagen"
              min={0.5}
              max={5}
              step={0.01}
              value={zoom}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="w-full accent-red-600"
            />
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-wide text-slate-300">
            Facebook
          </span>
          {fbStatus?.connected ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              {fbStatus.pageName ?? 'Conectado'}
            </span>
          ) : (
            <span className="text-xs text-slate-500">Desconectado</span>
          )}
        </div>

        {!fbStatus?.connected ? (
          <button
            type="button"
            onClick={onConnectFacebook}
            className="w-full rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-3 font-medium text-slate-200 transition hover:border-blue-500 hover:bg-blue-600/20 hover:text-white"
          >
            Conectar con Facebook
          </button>
        ) : (
          <button
            type="button"
            onClick={onPublishToFb}
            disabled={fbPublishing}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-900/40 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {fbPublishing ? 'Publicando en Facebook...' : 'Publicar en Facebook'}
          </button>
        )}

        {fbError && (
          <div className="mt-2 flex items-start justify-between gap-2 rounded-lg border border-red-800 bg-red-950/50 p-3">
            <p className="text-xs text-red-400">{fbError}</p>
            <button
              type="button"
              onClick={onClearFbError}
              className="mt-0.5 text-xs text-red-400 hover:text-white"
            >
              X
            </button>
          </div>
        )}

        {fbSuccess && (
          <div className="mt-2 flex items-start justify-between gap-2 rounded-lg border border-emerald-800 bg-emerald-950/50 p-3">
            <p className="text-xs text-emerald-400">Publicado en Facebook correctamente.</p>
            <button
              type="button"
              onClick={onClearFbSuccess}
              className="mt-0.5 text-xs text-emerald-400 hover:text-white"
            >
              X
            </button>
          </div>
        )}
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={onExport}
          disabled={isExporting}
          className="w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExporting ? 'Exportando...' : 'Exportar PNG'}
        </button>
        {exportError && <p className="mt-2 text-sm text-red-400">{exportError}</p>}
      </div>
    </div>
  )
}
