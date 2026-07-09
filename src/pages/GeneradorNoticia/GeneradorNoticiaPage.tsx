import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import GeneratorEditor from '../../features/generators/components/GeneratorEditor'
import { plantillaNoticia45 } from '../../features/generators/templates/PlantillaNoticia45'

/** Barra de navegación compartida entre los módulos generadores. */
export function GeneratorShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const tab = (to: string, label: string) => {
    const active = pathname === to
    return (
      <Link
        to={to}
        className={
          'rounded-lg px-4 py-2 text-sm font-medium transition ' +
          (active ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-slate-800')
        }
      >
        {label}
      </Link>
    )
  }
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-[#070b14] text-slate-100">
      <div className="flex min-h-screen w-full flex-col px-[10px] py-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Generador de plantillas</h1>
            <p className="text-sm text-slate-400">La Mira Noticiosa</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-1">
              {tab('/generador/noticia', 'Post')}
              {tab('/generador/video', 'Reels')}
              {tab('/generador/video-horizontal', 'Video')}
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}

/** Módulo generador de la plantilla Post. */
export default function GeneradorNoticiaPage() {
  return (
    <GeneratorShell>
      <GeneratorEditor definition={plantillaNoticia45} />
    </GeneratorShell>
  )
}
