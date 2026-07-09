import type { TemplateDefinition } from '../../types'
import PlantillaNoticia45 from './PlantillaNoticia45'

/** Descriptor de la plantilla de post en formato 4:5 (feed). */
export const plantillaNoticia45: TemplateDefinition = {
  id: 'noticia-45',
  name: 'Post',
  size: { width: 1080, height: 1350 },
  Component: PlantillaNoticia45,
  exportFileName: 'lamira-noticiosa-post',
  defaults: {
    category: 'Última hora',
    headline: '',
    imageUrl: null,
  },
}
