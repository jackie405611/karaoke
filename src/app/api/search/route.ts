import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export interface SearchResult {
  videoId: string
  title: string
  thumbnail: string
  channelTitle: string
  publishedAt: string
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'q is required' }, { status: 400 })

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'NO_API_KEY' }, { status: 503 })
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('maxResults', '12')
  url.searchParams.set('q', q)
  url.searchParams.set('key', apiKey)

  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return NextResponse.json({ error: err?.error?.message ?? 'YouTube API error' }, { status: res.status })
  }

  const data = await res.json()
  const results: SearchResult[] = (data.items ?? []).map((item: {
    id: { videoId: string }
    snippet: { title: string; thumbnails: { medium?: { url: string }; default?: { url: string } }; channelTitle: string; publishedAt: string }
  }) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
  }))

  return NextResponse.json(results)
}
