import videoFrameSrc from '../../features/generators/assets/video-frame.png'
import VideoReelEditor, { type VideoTemplateConfig } from '../../features/generators/components/VideoReelEditor'
import { GeneratorShell } from '../GeneradorNoticia/GeneradorNoticiaPage'

const videoHorizontalConfig: VideoTemplateConfig = {
  title: 'Video',
  frameSrc: videoFrameSrc,
  size: { width: 1080, height: 1350 },
  exportFileName: 'lamira-noticiosa-video.webm',
  initialHeadline: 'Titular aqui ejemplo',
  placeholder: 'Sube un video',
  badge: {
    left: 316,
    top: 927,
    minWidth: 410,
    height: 68,
    paddingX: 20,
    fontSize: 45,
    fontWeight: 900,
    background: '#d3242a',
    color: '#fff',
    border: 'none',
    radius: 0,
    textStrokeColor: '#000',
    textStrokeWidth: 1,
  },
  headlineBox: { left: 145, top: 1012, width: 790, minHeight: 90, paddingX: 0, paddingY: 8, radius: 0 },
  headlineBg: '#000',
  headlineWeight: 900,
  headlineSize: { initial: 64, min: 44, max: 86 },
  headlineTextAlign: 'center',
}

/** Módulo generador de video usando la plantilla nueva. */
export default function GeneradorVideoHorizontalPage() {
  return (
    <GeneratorShell>
      <VideoReelEditor config={videoHorizontalConfig} />
    </GeneratorShell>
  )
}
