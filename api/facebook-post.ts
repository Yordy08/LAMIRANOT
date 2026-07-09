interface VercelRequest {
  method?: string
  body?: unknown
  headers: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string | string[]) => void
}

interface PostRequestBody {
  image?: string
  headline?: string
  category?: string
}

function getBody(body: unknown): PostRequestBody {
  if (!body || typeof body !== 'object') return {}
  return body as PostRequestBody
}

function getCookie(req: VercelRequest, name: string): string | null {
  const raw = req.headers['cookie'] ?? ''
  const cookies = Array.isArray(raw) ? raw[0] : raw
  for (const part of cookies.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    if (key === name) return decodeURIComponent(part.slice(idx + 1).trim())
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).json(null)
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }

  const pageToken = getCookie(req, 'fb_page_token')
  const pageId = getCookie(req, 'fb_page_id')
  const pageName = getCookie(req, 'fb_page_name')

  if (!pageToken || !pageId) {
    res.status(401).json({ error: 'No hay sesión de Facebook activa. Conecta tu cuenta primero.' })
    return
  }

  const { image, headline, category } = getBody(req.body)
  if (!image || !headline) {
    res.status(400).json({ error: 'Falta la imagen o el titular.' })
    return
  }

  const message = [`${category ? `[${category.toUpperCase()}]` : ''} ${headline}`.trim()].join('\n\n')

  try {
    const base64Data = image.includes(',') ? image.split(',')[1] : image
    const imageBuffer = Buffer.from(base64Data, 'base64')

    const boundary = `----FormBoundary${Date.now()}`
    const header = Buffer.from(
      `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="source"; filename="post.png"\r\n' +
      'Content-Type: image/png\r\n\r\n',
      'utf-8',
    )
    const messagePart = Buffer.from(
      `\r\n--${boundary}\r\n` +
      'Content-Disposition: form-data; name="message"\r\n\r\n' +
      message + '\r\n',
      'utf-8',
    )
    const footer = Buffer.from(`--${boundary}--\r\n`, 'utf-8')

    const bodyBuffer = Buffer.concat([header, imageBuffer, messagePart, footer])

    const fbRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/photos?access_token=${encodeURIComponent(pageToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body: bodyBuffer,
      },
    )

    const fbData = (await fbRes.json()) as { id?: string; error?: { message?: string } }

    if (!fbRes.ok || fbData.error) {
      res.status(502).json({
        error: 'Facebook rechazó la publicación.',
        detail: fbData.error?.message ?? 'Error desconocido',
      })
      return
    }

    res.status(200).json({
      success: true,
      postId: fbData.id,
      pageName,
    })
  } catch (err) {
    res.status(502).json({
      error: 'Error al conectar con Facebook.',
      detail: err instanceof Error ? err.message : 'Error desconocido',
    })
  }
}
