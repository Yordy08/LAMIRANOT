interface VercelRequest {
  method?: string
  query?: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  send: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

function getUrlParam(query?: Record<string, string | string[] | undefined>) {
  const raw = query?.url
  return Array.isArray(raw) ? raw[0] : raw
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).json(null)
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }

  const url = getUrlParam(req.query)
  if (!url) {
    res.status(400).json({ error: 'Falta la URL de la imagen.' })
    return
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    res.status(400).json({ error: 'URL inválida.' })
    return
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    res.status(400).json({ error: 'Protocolo no permitido.' })
    return
  }

  const response = await fetch(parsedUrl.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 LamiraNot/1.0',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    res.status(response.status).json({ error: 'No se pudo cargar la imagen del medio.' })
    return
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/')) {
    res.status(415).json({ error: 'La URL no devolvió una imagen.' })
    return
  }

  const arrayBuffer = await response.arrayBuffer()
  res.setHeader('Content-Type', contentType)
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.send(new Uint8Array(arrayBuffer))
}
