import { useEffect, useState } from 'react'

interface RecentNewsItem {
  id: string
  title: string
  rewrittenTitle: string
  transformedDescription: string
  category: string
  summary: string
  source: string
  link: string
  imageUrl: string | null
  imageSearchQuery: string
}

interface AiRewriteResult {
  titular?: string
  descripcion?: string
  categoria?: string
}

interface RecentNewsPickerProps {
  onSelect: (news: RecentNewsItem) => Promise<boolean>
}

const FEED_URL =
  'https://news.google.com/rss/search?q=' +
  encodeURIComponent('site:eltiempo.com OR site:elespectador.com OR site:elcolombiano.com OR site:semana.com Colombia') +
  '&hl=es-419&gl=CO&ceid=CO:es-419'

const feedProxyUrls = [
  `https://api.allorigins.win/raw?url=${encodeURIComponent(FEED_URL)}`,
  `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(FEED_URL)}`,
]

const RSS_JSON_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(FEED_URL)}`

function proxiedImageUrl(url: string) {
  return `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}`
}

async function fetchTextWithFallback(urls: string[]) {
  let lastError: unknown = null

  for (const url of urls) {
    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 12000)
      const response = await fetch(url, { signal: controller.signal })
      window.clearTimeout(timeout)

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const text = await response.text()
      if (text.trim()) return text
    } catch (err) {
      lastError = err
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No se pudo consultar noticias recientes.')
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12000)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

function stripHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function getImageUrl(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.querySelector('img')?.getAttribute('src') ?? null
}

function getXmlImageUrl(item: Element, description: string) {
  return (
    item.querySelector('enclosure[url]')?.getAttribute('url') ??
    item.querySelector('media\\:content[url]')?.getAttribute('url') ??
    item.querySelector('media\\:thumbnail[url]')?.getAttribute('url') ??
    getImageUrl(description)
  )
}

function getRssJsonImageUrl(item: Record<string, unknown>, description: string) {
  const thumbnail = typeof item.thumbnail === 'string' && item.thumbnail ? item.thumbnail : null
  const enclosure = item.enclosure
  const enclosureLink =
    enclosure && typeof enclosure === 'object' && 'link' in enclosure && typeof enclosure.link === 'string'
      ? enclosure.link
      : null
  return thumbnail ?? enclosureLink ?? getImageUrl(description)
}

function rewriteHeadline(title: string, source: string) {
  const cleanTitle = title.replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '').trim()
  const words = cleanTitle.split(/\s+/).filter(Boolean).slice(0, 10).join(' ')
  return words || title
}

function classifyCategory(text: string) {
  const value = text.toLowerCase()
  if (/emergencia|accidente|incendio|derrumbe|inundaci[oó]n|desastre|heridos|muertos|rescate/.test(value)) return 'Alerta'
  if (/captura|asesinato|homicidio|ataque|explosi[oó]n|sorpresa|esc[aá]ndalo|grave/.test(value)) return 'Impactante'
  if (/gobierno|congreso|presidente|petro|reforma|ministro|senado|c[aá]mara|pol[ií]tica/.test(value)) return 'Nacional'
  if (/historia|familia|niñ|madre|padre|comunidad|solidaridad|vida/.test(value)) return 'Emotivo'
  if (/urgente|[úu]ltima hora|reciente|minuto/.test(value)) return 'Lo último'
  return 'Es noticia'
}

function buildDescription(title: string, summary: string, source: string) {
  const cleanTitle = title.replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '').trim()
  const cleanSummary = summary.replace(cleanTitle, '').replace(source, '').replace(/\s+/g, ' ').trim()
  const context = cleanSummary || cleanTitle

  return [
    `Según la información publicada por ${source}, ${cleanTitle}.`,
    context
      ? `El hecho toma relevancia porque ${context.charAt(0).toLowerCase()}${context.slice(1)}`
      : 'La información mantiene el foco en los datos conocidos hasta el momento, sin añadir versiones no confirmadas.',
    'La lectura del caso permite entender el alcance del hecho y su impacto público con base únicamente en la información disponible.',
  ].join('\n\n')
}

function imageQueryFrom(title: string) {
  return title
    .replace(/\s+-\s+[^-]+$/, '')
    .replace(/["“”'.,:;!?¿¡()]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 6)
    .join(' ')
}

async function findRelatedImage(query: string) {
  if (!query) return null
  const apiUrl =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: query,
      gsrnamespace: '6',
      gsrlimit: '1',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '1200',
      format: 'json',
      origin: '*',
    })

  try {
    const response = await fetchWithTimeout(apiUrl)
    if (!response.ok) return null
    const data = await response.json()
    const pages = data?.query?.pages
    if (!pages || typeof pages !== 'object') return null
    const firstPage = Object.values(pages)[0] as { imageinfo?: Array<{ thumburl?: string; url?: string }> }
    return firstPage.imageinfo?.[0]?.thumburl ?? firstPage.imageinfo?.[0]?.url ?? null
  } catch {
    return null
  }
}

async function rewriteWithAi(news: RecentNewsItem) {
  try {
    const response = await fetch('/api/rewrite-news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: news.title, summary: news.summary, source: news.source }),
    })

    if (!response.ok) return null
    const data = (await response.json()) as AiRewriteResult
    if (!data.titular || !data.descripcion || !data.categoria) return null

    return {
      rewrittenTitle: data.titular,
      transformedDescription: data.descripcion,
      category: data.categoria,
    }
  } catch {
    return null
  }
}

function parseFeed(xmlText: string): RecentNewsItem[] {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml')
  return Array.from(xml.querySelectorAll('item'))
    .slice(0, 12)
    .map((item, index) => {
      const title = item.querySelector('title')?.textContent?.trim() ?? 'Sin titular'
      const source = item.querySelector('source')?.textContent?.trim() ?? 'Medio colombiano'
      const description = item.querySelector('description')?.textContent ?? ''
      const link = item.querySelector('link')?.textContent?.trim() ?? '#'
      const summary = stripHtml(description)
      const searchableText = `${title} ${summary}`
      const rewrittenTitle = rewriteHeadline(title, source)
      return {
        id: `${link}-${index}`,
        title,
        rewrittenTitle,
        transformedDescription: buildDescription(title, summary, source),
        category: classifyCategory(searchableText),
        summary,
        source,
        link,
        imageUrl: getXmlImageUrl(item, description),
        imageSearchQuery: imageQueryFrom(title),
      }
    })
}

function parseRssJson(data: unknown): RecentNewsItem[] {
  if (!data || typeof data !== 'object' || !('items' in data) || !Array.isArray(data.items)) return []

  return data.items.slice(0, 12).map((item: Record<string, unknown>, index: number) => {
    const title = typeof item.title === 'string' ? item.title : 'Sin titular'
    const author = typeof item.author === 'string' ? item.author : ''
    const source = author || title.split(' - ').at(-1) || 'Medio colombiano'
    const description = typeof item.description === 'string' ? item.description : ''
    const link = typeof item.link === 'string' ? item.link : '#'
    const thumbnail = getRssJsonImageUrl(item, description)
    const summary = stripHtml(description)
    const searchableText = `${title} ${summary}`

    return {
      id: `${link}-${index}`,
      title,
      rewrittenTitle: rewriteHeadline(title, source),
      transformedDescription: buildDescription(title, summary, source),
      category: classifyCategory(searchableText),
      summary,
      source,
      link,
      imageUrl: thumbnail,
      imageSearchQuery: imageQueryFrom(title),
    }
  })
}

async function fetchNews() {
  try {
    const response = await fetchWithTimeout(RSS_JSON_URL)
    if (response.ok) {
      const news = parseRssJson(await response.json())
      if (news.length) return news
    }
  } catch {
    /* usar RSS XML como respaldo */
  }

  return parseFeed(await fetchTextWithFallback(feedProxyUrls))
}

export default function RecentNewsPicker({ onSelect }: RecentNewsPickerProps) {
  const [items, setItems] = useState<RecentNewsItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedDescription, setSelectedDescription] = useState<string | null>(null)
  const [isRewriting, setIsRewriting] = useState(false)

  const loadNews = async () => {
    setIsLoading(true)
    setMessage(null)
    try {
      const news = await fetchNews()
      setItems(news)
      if (!news.length) setMessage('No se encontraron noticias recientes en este momento.')
    } catch (err) {
      setMessage(
        err instanceof Error
          ? `No se pudo consultar noticias recientes. Intenta Actualizar en unos segundos. (${err.message})`
          : 'No se pudo consultar noticias recientes. Intenta Actualizar en unos segundos.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadNews()
  }, [])

  const selectNews = async (news: RecentNewsItem) => {
    setSelectedId(news.id)
    setMessage(null)
    setIsRewriting(true)

    const aiRewrite = await rewriteWithAi(news)
    const finalNews = aiRewrite ? { ...news, ...aiRewrite } : news
    setSelectedDescription(finalNews.transformedDescription)

    const imageUrl = finalNews.imageUrl ?? (await findRelatedImage(finalNews.imageSearchQuery))
    const imageLoaded = await onSelect({ ...finalNews, imageUrl })
    setMessage(
      imageLoaded || !imageUrl
        ? aiRewrite
          ? 'Noticia aplicada al Post con Gemini e imagen del medio.'
          : 'Noticia aplicada al Post con transformación local e imagen del medio. Revisa GEMINI_API_KEY si esperabas Gemini.'
        : 'Noticia aplicada. La imagen relacionada no permitió importarse; puedes subirla manualmente.',
    )
    setIsRewriting(false)
  }

  return (
    <section className="mb-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-200">Noticias recientes</h3>
          <p className="text-xs text-slate-500">Medios colombianos para crear un Post rápido.</p>
        </div>
        <button
          type="button"
          onClick={loadNews}
          disabled={isLoading}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-red-500 hover:text-white disabled:opacity-60"
        >
          {isLoading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>

      {isRewriting && <p className="mb-3 text-xs text-slate-400">Generando titular y descripción con Gemini...</p>}
      {message && <p className="mb-3 text-xs text-slate-400">{message}</p>}
      {selectedDescription && (
        <div className="mb-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Descripción generada</p>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(selectedDescription)}
              className="text-xs text-slate-400 underline-offset-2 transition hover:text-white hover:underline"
            >
              Copiar
            </button>
          </div>
          <p className="whitespace-pre-line text-xs leading-relaxed text-slate-400">{selectedDescription}</p>
        </div>
      )}

      <div className="max-h-96 space-y-3 overflow-auto pr-1">
        {items.map((news) => (
          <article key={news.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="mb-2 flex gap-3">
              {news.imageUrl && (
                <img
                  src={proxiedImageUrl(news.imageUrl)}
                  alt=""
                  className="h-16 w-16 flex-none rounded-md object-cover"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.remove()
                  }}
                />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-red-400">{news.source}</p>
                <h4 className="line-clamp-3 text-sm font-semibold leading-snug text-white">{news.title}</h4>
                <p className="mt-1 text-xs font-semibold text-slate-500">Categoría sugerida: {news.category}</p>
              </div>
            </div>
            <p className="line-clamp-3 text-xs leading-relaxed text-slate-400">{news.summary}</p>
            <button
              type="button"
              onClick={() => void selectNews(news)}
              disabled={selectedId === news.id || isRewriting}
              className="mt-3 w-full rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-500 disabled:opacity-60"
            >
              {selectedId === news.id ? 'Aplicada' : 'Usar en Post'}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
