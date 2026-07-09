import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../features/auth/AuthProvider'

export function GeneratorShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { logout } = useAuth()
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
              {tab('/generador/video', 'Reels')}
              {tab('/generador/video-horizontal', 'Video')}
            </nav>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-red-500 hover:text-white"
            >
              Deslogueo
            </button>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
