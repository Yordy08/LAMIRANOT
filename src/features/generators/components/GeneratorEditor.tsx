import { useCallback, useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import type { ForegroundTransform, NewsTemplateData, TemplateDefinition } from '../types'
import { useGenerator } from '../state/GeneratorProvider'
import { useExportPng } from '../hooks/useExportPng'
import EditorForm from './EditorForm'
import TemplateStage from './TemplateStage'
import RecentNewsPicker from './RecentNewsPicker'

interface GeneratorEditorProps {
  definition: TemplateDefinition
}

/**
 * Editor reutilizable: panel izquierdo con el formulario y panel derecho con la
 * vista previa en tiempo real. Los datos (categoría, titular, imagen) vienen del
 * estado compartido, por lo que se conservan al cambiar de plantilla. La posición
 * del encuadre es independiente por plantilla.
 */
export default function GeneratorEditor({ definition }: GeneratorEditorProps) {
  const g = useGenerator()
  const exportRef = useRef<HTMLDivElement>(null)

  const { exportPng, isExporting, error } = useExportPng({
    nodeRef: exportRef,
    size: definition.size,
    fileName: definition.exportFileName,
  })

  const data: NewsTemplateData = {
    category: g.category,
    headline: g.headline,
    imageUrl: g.imageDataUrl,
  }
  const position = g.getPosition(definition.id)
  const resizeMode = g.getResizeMode(definition.id)
  const foreground = g.getTransform(definition.id)
  const headlineScale = g.getHeadlineScale(definition.id)

  const { setTransform } = g
  const handleForegroundChange = useCallback(
    (t: ForegroundTransform) => setTransform(definition.id, t),
    [setTransform, definition.id],
  )

  const handleNewsSelect = useCallback(
    async (news: { rewrittenTitle: string; category: string; imageUrl: string | null }) => {
      g.setCategory(news.category)
      g.setHeadline(news.rewrittenTitle)
      if (!news.imageUrl) return false
      return g.setImageFromUrl(news.imageUrl)
    },
    [g],
  )

  const [fbStatus, setFbStatus] = useState<{ connected: boolean; pageName?: string } | null>(null)
  const [fbPublishing, setFbPublishing] = useState(false)
  const [fbError, setFbError] = useState<string | null>(null)
  const [fbSuccess, setFbSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/facebook-status')
      .then((r) => r.json())
      .then((data) => setFbStatus(data))
      .catch(() => setFbStatus({ connected: false }))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fb = params.get('fb')
    if (fb === 'connected') {
      setFbStatus({ connected: true })
      window.history.replaceState({}, '', window.location.pathname)
      fetch('/api/facebook-status')
        .then((r) => r.json())
        .then((data) => setFbStatus(data))
        .catch(() => {})
    } else if (fb === 'denied') {
      window.history.replaceState({}, '', window.location.pathname)
    } else if (fb === 'error') {
      const detail = params.get('detail')
      setFbError(detail ? decodeURIComponent(detail) : 'Error al conectar con Facebook')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const publishToFb = useCallback(async () => {
    const node = exportRef.current
    if (!node || fbPublishing) return

    setFbPublishing(true)
    setFbError(null)
    setFbSuccess(false)

    try {
      if (document.fonts?.ready) await document.fonts.ready

      const dataUrl = await toPng(node, {
        width: definition.size.width,
        height: definition.size.height,
        pixelRatio: 1,
        cacheBust: false,
        style: { transform: 'none', transformOrigin: 'top left', margin: '0' },
      })

      const response = await fetch('/api/facebook-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrl,
          headline: g.headline,
          category: g.category,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setFbError(result.error || result.detail || 'Error al publicar en Facebook')
        return
      }

      setFbSuccess(true)
    } catch (err) {
      setFbError(err instanceof Error ? err.message : 'Error al publicar en Facebook')
    } finally {
      setFbPublishing(false)
    }
  }, [exportRef, definition.size, g.headline, g.category, fbPublishing])

  const connectFacebook = useCallback(() => {
    window.location.href = '/api/facebook-login'
  }, [])

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      {/* Panel izquierdo */}
      <aside className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="mb-1 text-xl font-bold text-white">{definition.name}</h2>
        <p className="mb-6 text-sm text-slate-400">
          {definition.size.width} × {definition.size.height} px
        </p>
        {definition.id === 'noticia-45' && <RecentNewsPicker onSelect={handleNewsSelect} />}
        <EditorForm
          data={data}
          onCategoryChange={g.setCategory}
          onHeadlineChange={g.setHeadline}
          headlineScale={headlineScale}
          onHeadlineScaleChange={(s) => g.setHeadlineScale(definition.id, s)}
          onImageChange={g.setImageFile}
          onExport={exportPng}
          isExporting={isExporting}
          exportError={error}
          resizeMode={resizeMode}
          onToggleResize={() => g.setResizeMode(definition.id, !resizeMode)}
          zoom={foreground.zoom}
          onZoomChange={(zoom) => handleForegroundChange({ ...foreground, zoom })}
          onResetForeground={() => handleForegroundChange({ zoom: 1, x: 0, y: 0 })}
          fbStatus={fbStatus}
          fbPublishing={fbPublishing}
          fbError={fbError}
          fbSuccess={fbSuccess}
          onConnectFacebook={connectFacebook}
          onPublishToFb={publishToFb}
          onClearFbSuccess={() => setFbSuccess(false)}
          onClearFbError={() => setFbError(null)}
        />
        {data.imageUrl && !resizeMode && (
          <p className="mt-4 text-xs text-slate-500">
            Arrastra la imagen en la vista previa para reencuadrarla.
          </p>
        )}
        {data.imageUrl && resizeMode && (
          <p className="mt-4 text-xs text-slate-500">
            Arrastra para mover la imagen y usa la rueda o el control de zoom para ampliarla y
            recortarla donde quieras.
          </p>
        )}
      </aside>

      {/* Panel derecho: ocupa todo el espacio disponible */}
      <section className="min-h-[60vh] rounded-2xl border border-slate-800 bg-slate-950/60 lg:min-h-0">
        <TemplateStage
          definition={definition}
          data={data}
          exportRef={exportRef}
          imagePosition={position}
          onPositionChange={(pos) => g.setPosition(definition.id, pos)}
          resizeMode={resizeMode}
          foreground={foreground}
          onForegroundChange={handleForegroundChange}
          headlineScale={headlineScale}
        />
      </section>
    </div>
  )
}
