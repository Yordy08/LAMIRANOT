import VideoReelEditor from '../../features/generators/components/VideoReelEditor'
import { GeneratorShell } from '../GeneradorNoticia/GeneradorNoticiaPage'

/** Módulo generador de Reels con plantilla nueva. */
export default function GeneradorVideoPage() {
  return (
    <GeneratorShell>
      <VideoReelEditor />
    </GeneratorShell>
  )
}
