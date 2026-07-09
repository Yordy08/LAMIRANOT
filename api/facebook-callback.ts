interface VercelRequest {
  query?: Record<string, string | string[] | undefined>
  headers: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  redirect: (url: string) => void
  setHeader: (name: string, value: string | string[]) => void
}

function getParam(query: Record<string, string | string[] | undefined> | undefined, name: string): string | undefined {
  const raw = query?.[name]
  return Array.isArray(raw) ? raw[0] : raw
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET

  if (!appId || !appSecret) {
    res.status(500).json({ error: 'Falta configurar FACEBOOK_APP_ID o FACEBOOK_APP_SECRET en Vercel.' })
    return
  }

  const code = getParam(req.query, 'code')
  const error = getParam(req.query, 'error')
  if (error) {
    res.redirect('/generador/noticia?fb=denied')
    return
  }
  if (!code) {
    res.status(400).json({ error: 'Falta el código de autorización.' })
    return
  }

  const host = req.headers['x-forwarded-host'] ?? req.headers['host'] ?? 'localhost:5173'
  const proto = req.headers['x-forwarded-proto'] ?? 'http'
  const protoStr = Array.isArray(proto) ? proto[0] : proto
  const hostStr = Array.isArray(host) ? host[0] : host
  const redirectUri = `${protoStr}://${hostStr}/api/facebook-callback`

  const tokenUrl = 'https://graph.facebook.com/v19.0/oauth/access_token?' + new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    client_secret: appSecret,
    code,
  })

  const tokenRes = await fetch(tokenUrl)
  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    res.redirect(`/generador/noticia?fb=error&detail=${encodeURIComponent(text)}`)
    return
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string }
  if (!tokenData.access_token) {
    res.redirect('/generador/noticia?fb=error&detail=no_token')
    return
  }

  const longTokenUrl = 'https://graph.facebook.com/v19.0/oauth/access_token?' + new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: tokenData.access_token,
  })

  const longTokenRes = await fetch(longTokenUrl)
  if (!longTokenRes.ok) {
    res.redirect('/generador/noticia?fb=error&detail=long_token_failed')
    return
  }

  const longTokenData = (await longTokenRes.json()) as { access_token?: string }
  const longLivedToken = longTokenData.access_token ?? tokenData.access_token

  const pagesUrl = 'https://graph.facebook.com/v19.0/me/accounts?' + new URLSearchParams({
    access_token: longLivedToken,
  })

  const pagesRes = await fetch(pagesUrl)
  const pagesData = (await pagesRes.json()) as {
    data?: Array<{ id: string; name: string; access_token: string }>
  }

  const page = pagesData.data?.[0]
  if (!page) {
    res.redirect('/generador/noticia?fb=error&detail=no_pages')
    return
  }

  res.setHeader('Set-Cookie', [
    `fb_page_token=${encodeURIComponent(page.access_token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`,
    `fb_page_id=${page.id}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`,
    `fb_page_name=${encodeURIComponent(page.name)}; Path=/; SameSite=Lax; Max-Age=2592000`,
  ])

  res.redirect('/generador/noticia?fb=connected')
}
