import { useCallback, useRef } from 'react'
import type { ForegroundTransform, NewsTemplateData, TemplateDefinition } from '../types'
import { useGenerator } from '../state/GeneratorProvider'
import { useExportPng } from '../hooks/useExportPng'
import EditorForm from './EditorForm'
import TemplateStage from './TemplateStage'

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

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      {/* Panel izquierdo */}
      <aside className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="mb-1 text-xl font-bold text-white">{definition.name}</h2>
        <p className="mb-6 text-sm text-slate-400">
          {definition.size.width} × {definition.size.height} px
        </p>
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
