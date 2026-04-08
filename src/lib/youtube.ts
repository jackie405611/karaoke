export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]
  for (const pattern of patterns) {
    const match = url.trim().match(pattern)
    if (match) return match[1]
  }
  return null
}

export function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export interface YouTubeMetadata {
  title: string
  thumbnail: string
  author: string
}

export async function fetchYouTubeMetadata(videoId: string): Promise<YouTubeMetadata> {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Cannot fetch metadata for video ${videoId}`)
  const data = await res.json()
  return {
    title: data.title ?? 'Unknown Title',
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    author: data.author_name ?? '',
  }
}

export interface PlaylistVideoItem {
  videoId: string
  title: string
  thumbnail: string
}

export async function fetchPlaylistItems(
  playlistId: string,
  apiKey: string
): Promise<PlaylistVideoItem[]> {
  const items: PlaylistVideoItem[] = []
  let pageToken: string | undefined

  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('playlistId', playlistId)
    url.searchParams.set('maxResults', '50')
    url.searchParams.set('key', apiKey)
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const res = await fetch(url.toString())
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message ?? `YouTube API error ${res.status}`)
    }

    const data = await res.json()

    for (const item of data.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId
      // Skip deleted/private videos
      if (!videoId || item.snippet?.title === 'Deleted video' || item.snippet?.title === 'Private video') continue
      items.push({
        videoId,
        title: item.snippet.title ?? 'Unknown',
        thumbnail:
          item.snippet.thumbnails?.medium?.url ??
          item.snippet.thumbnails?.default?.url ??
          `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      })
    }

    pageToken = data.nextPageToken
  } while (pageToken)

  return items
}
