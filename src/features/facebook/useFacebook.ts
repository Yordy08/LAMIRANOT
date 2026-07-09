import { useCallback, useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    FB?: {
      init: (opts: { appId: string; version: string; cookie?: boolean }) => void
      login: (
        cb: (res: { authResponse?: { accessToken: string }; status?: string }) => void,
        opts: { scope: string },
      ) => void
      api: (
        path: string,
        method: string,
        params: Record<string, unknown>,
        cb: (res: { data?: Array<{ id: string; name: string; access_token: string }>; error?: { message: string } }) => void,
      ) => void
      getLoginStatus: (cb: (res: { status: string; authResponse?: { accessToken: string } }) => void) => void
    }
    fbAsyncInit?: () => void
  }
}

const FB_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || ''
const API_VERSION = 'v19.0'

interface FacebookState {
  connected: boolean
  pageId: string
  pageName: string
  pageToken: string
}

function loadState(): FacebookState | null {
  try {
    const raw = localStorage.getItem('lamira:fb')
    if (!raw) return null
    const parsed = JSON.parse(raw) as FacebookState
    if (parsed.pageToken) return parsed
    return null
  } catch {
    return null
  }
}

function saveState(state: FacebookState) {
  try {
    localStorage.setItem('lamira:fb', JSON.stringify(state))
  } catch { /* noop */ }
}

function clearState() {
  try { localStorage.removeItem('lamira:fb') } catch { /* noop */ }
}

let sdkPromise: Promise<void> | null = null

function loadSdk(appId: string): Promise<void> {
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<void>((resolve) => {
    if (window.FB) { resolve(); return }

    window.fbAsyncInit = () => {
      window.FB!.init({ appId, version: API_VERSION, cookie: true })
      resolve()
    }

    const script = document.createElement('script')
    script.src = 'https://connect.facebook.net/es_LA/sdk.js'
    script.async = true
    script.defer = true
    script.onerror = () => { sdkPromise = null; resolve() }
    document.body.appendChild(script)
  })

  return sdkPromise
}

export function useFacebook() {
  const [fbState, setFbState] = useState<FacebookState | null>(loadState)
  const [sdkReady, setSdkReady] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!FB_APP_ID) return
    loadSdk(FB_APP_ID).then(() => {
      if (mountedRef.current) setSdkReady(true)
    })
  }, [])

  const login = useCallback(() => {
    if (!window.FB) { setError('SDK de Facebook no cargado.'); return }

    window.FB.login((res) => {
      if (!res.authResponse) {
        setError('Inicio de sesión cancelado por el usuario.')
        return
      }

      const userToken = res.authResponse.accessToken

      window.FB!.api(
        '/me/accounts',
        'GET',
        { access_token: userToken, limit: 25 },
        (pagesRes) => {
          if (pagesRes.error) {
            setError(pagesRes.error.message)
            return
          }

          const pages = pagesRes.data ?? []
          if (!pages.length) {
            setError('No tienes páginas en Facebook. Crea una página para publicar.')
            return
          }

          const page = pages[0]
          const state: FacebookState = {
            connected: true,
            pageId: page.id,
            pageName: page.name,
            pageToken: page.access_token,
          }
          saveState(state)
          if (mountedRef.current) {
            setFbState(state)
            setError(null)
          }
        },
      )
    }, { scope: 'pages_manage_posts,pages_read_engagement' })
  }, [])

  const logout = useCallback(() => {
    clearState()
    setFbState(null)
    setError(null)
    setSuccess(false)
  }, [])

  const publish = useCallback(async (imageDataUrl: string, headline: string, category: string) => {
    const state = fbState ?? loadState()
    if (!state?.pageToken || !state?.pageId) {
      setError('No hay sesión de Facebook activa.')
      return
    }

    setPublishing(true)
    setError(null)
    setSuccess(false)

    try {
      const blobRes = await fetch(imageDataUrl)
      const blob = await blobRes.blob()

      const formData = new FormData()
      formData.append('source', blob, 'post.png')
      const message = [`${category ? `[${category.toUpperCase()}]` : ''} ${headline}`.trim()].join('\n\n')
      formData.append('message', message)
      formData.append('access_token', state.pageToken)

      const fbRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${state.pageId}/photos`, {
        method: 'POST',
        body: formData,
      })

      const result = (await fbRes.json()) as { id?: string; error?: { message?: string } }

      if (!fbRes.ok || result.error) {
        setError(result.error?.message ?? 'Error al publicar en Facebook')
        return
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al publicar en Facebook')
    } finally {
      setPublishing(false)
    }
  }, [fbState])

  return {
    sdkReady,
    connected: !!fbState,
    pageName: fbState?.pageName ?? null,
    publishing,
    error,
    success,
    login,
    logout,
    publish,
    clearError: () => setError(null),
    clearSuccess: () => setSuccess(false),
  }
}
