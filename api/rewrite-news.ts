interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

interface RewriteRequestBody {
  title?: string
  summary?: string
  source?: string
}

const env = globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
const MODEL = env.process?.env?.GEMINI_MODEL || 'gemini-2.5-flash'
const FALLBACK_MODELS = [MODEL, 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-3.1-flash-lite']

function getGeminiUrl(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

function getBody(body: unknown): RewriteRequestBody {
  if (!body || typeof body !== 'object') return {}
  return body as RewriteRequestBody
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

  const apiKey = env.process?.env?.GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel.' })
    return
  }

  const { title = '', summary = '', source = '' } = getBody(req.body)
  if (!title.trim()) {
    res.status(400).json({ error: 'Falta el titular original.' })
    return
  }

  const prompt = JSON.stringify({
    rol: 'Eres un editor profesional de noticias para redes sociales en Colombia. Tu estilo es serio, directo y atractivo.',
    reglas: [
      'No inventes datos, nombres, cifras, lugares ni autores.',
      'Usa solo la información proporcionada.',
      'Devuelve únicamente JSON válido, sin markdown.',
    ],
    instrucciones: {
      titular:
        'Genera un titular completo y correcto de máximo 10 palabras. Debe ser claro, contundente y captar la esencia de la noticia. Sin comillas, sin referencia a la fuente, sin guiones. Solo el titular limpio y directo.',
      descripcion:
        'Redacta 2 párrafos completos y coherentes. Primer párrafo: explica qué ocurrió, quiénes están involucrados y cuál es el contexto inmediato. Segundo párrafo: por qué es relevante, impacto público y qué esperar. Usa un tono periodístico serio. No inventes información que no esté en los datos proporcionados.',
      categoria: 'Elige solo una: Nacional, Atención, Alerta, Lo último, Es noticia, Emotivo, Impactante.',
    },
    noticia: { titular_original: title, resumen: summary, fuente: source },
    formato_respuesta: {
      titular: 'string',
      descripcion: 'string',
      categoria: 'string',
    },
  })

  const requestBody = JSON.stringify({
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json',
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  })

  let response: Response | null = null
  let errorText = ''

  for (const model of FALLBACK_MODELS) {
    response = await fetch(`${getGeminiUrl(model)}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    })

    if (response.ok) break

    errorText = await response.text()
    if (![429, 503, 404].includes(response.status)) break
  }

  if (!response?.ok) {
    res.status(response?.status ?? 502).json({ error: 'Gemini no pudo procesar la noticia.', detail: errorText })
    return
  }

  const data = await response.json()
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof content !== 'string') {
    res.status(502).json({ error: 'Respuesta inválida de Gemini.' })
    return
  }

  try {
    const parsed = JSON.parse(content)
    res.status(200).json(parsed)
  } catch {
    res.status(502).json({ error: 'Gemini no devolvió JSON válido.', detail: content })
  }
}
