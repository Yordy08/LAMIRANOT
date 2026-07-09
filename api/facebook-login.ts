interface VercelRequest {
  headers: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  redirect: (url: string) => void
  setHeader: (name: string, value: string) => void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const appId = process.env.FACEBOOK_APP_ID
  if (!appId) {
    res.status(500).json({ error: 'Falta configurar FACEBOOK_APP_ID en Vercel.' })
    return
  }

  const host = req.headers['x-forwarded-host'] ?? req.headers['host'] ?? 'localhost:5173'
  const proto = req.headers['x-forwarded-proto'] ?? 'http'
  const protoStr = Array.isArray(proto) ? proto[0] : proto
  const hostStr = Array.isArray(host) ? host[0] : host
  const redirectUri = `${protoStr}://${hostStr}/api/facebook-callback`

  const fbUrl =
    'https://www.facebook.com/v19.0/dialog/oauth?' +
    new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: 'pages_manage_posts,pages_read_engagement,pages_show_list',
      response_type: 'code',
    })

  res.redirect(fbUrl)
}
