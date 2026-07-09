import type { TemplateComponentProps, FrameLayout } from '../../types'
import NewsFrameTemplate from '../../components/NewsFrameTemplate'
import frameSrc from '../../assets/post-frame.png'

/**
 * PlantillaNoticia45 — post La Mira Noticiosa, formato feed 4:5 (1080×1350).
 * Diseño fijo provisto por el marco PNG. Solo cambian categoría, titular e imagen.
 */
const layout: FrameLayout = {
  frameSrc,
  badge: {
    left: 316,
    top: 927,
    minWidth: 410,
    height: 68,
    fontSize: 45,
    fontWeight: 900,
    paddingX: 20,
    borderRadius: '0',
    background: '#d3242a',
    border: 'none',
    color: '#fff',
    textStroke: '1px #000',
  },
  headline: {
    left: 145,
    top: 1012,
    right: 145,
    fontSize: 64,
    lineHeight: 74,
    fontWeight: 900,
    textAlign: 'center',
    color: '#fff',
    background: '#000',
    paddingY: 8,
  },
}

export default function PlantillaNoticia45(props: TemplateComponentProps) {
  return <NewsFrameTemplate {...props} layout={layout} />
}
