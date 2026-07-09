interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).json(null)
    return
  }

  const pageToken = getCookie(req, 'fb_page_token')
  const pageId = getCookie(req, 'fb_page_id')
  const pageName = getCookie(req, 'fb_page_name')

  if (!pageToken || !pageId) {
    res.status(200).json({ connected: false })
    return
  }

  const fbRes = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}?fields=name&access_token=${pageToken}`,
  )

  if (!fbRes.ok) {
    res.status(200).json({ connected: false })
    return
  }

  const data = (await fbRes.json()) as { name?: string }
  res.status(200).json({
    connected: true,
    pageId,
    pageName: pageName ?? data.name ?? 'Página de Facebook',
  })
}
