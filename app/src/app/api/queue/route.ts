import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { notifyQueueUpdate } from '@/lib/events'
import { getRoomByCode, RoomError, roomNotFoundResponse } from '@/lib/rooms'
import {
  extractVideoId,
  extractPlaylistId,
  fetchYouTubeMetadata,
  fetchPlaylistItems,
} from '@/lib/youtube'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const room = await getRoomByCode(req.nextUrl.searchParams.get('room'))
    const sql = getDb()
    const rows = await sql`
      SELECT q.id, q.video_id, q.queue_order, q.status, q.requested_by, q.created_at,
             v.youtube_video_id, v.title, v.thumbnail, v.duration
      FROM queue q
      JOIN videos v ON v.id = q.video_id
      WHERE q.room_id = ${room.id} AND q.status != 'done'
      ORDER BY q.queue_order ASC
    `
    return NextResponse.json(rows)
  } catch (err) {
    if (err instanceof RoomError) return roomNotFoundResponse()
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const room = await getRoomByCode(req.nextUrl.searchParams.get('room'))
    const { youtube_url, requested_by = 'Guest' } = await req.json()
    if (!youtube_url) return NextResponse.json({ error: 'youtube_url is required' }, { status: 400 })

    const sql = getDb()

    // ── Playlist URL ──────────────────────────────────────────────────────
    const playlistId = extractPlaylistId(youtube_url)
    if (playlistId) {
      const apiKey = process.env.YOUTUBE_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'NO_API_KEY', message: 'ต้องตั้งค่า YOUTUBE_API_KEY' }, { status: 503 })

      const items = await fetchPlaylistItems(playlistId, apiKey)
      if (items.length === 0) return NextResponse.json({ error: 'ไม่พบเพลงใน playlist' }, { status: 404 })

      const [{ m: maxOrder }] = await sql`
        SELECT COALESCE(MAX(queue_order), 0)::int AS m FROM queue WHERE room_id = ${room.id} AND status != 'done'
      ` as { m: number }[]
      const hasPlaying = await sql`SELECT id FROM queue WHERE room_id = ${room.id} AND status = 'playing' LIMIT 1`

      let order = maxOrder
      let firstAdded = false
      for (const item of items) {
        await sql`
          INSERT INTO videos (youtube_video_id, title, thumbnail)
          VALUES (${item.videoId}, ${item.title}, ${item.thumbnail})
          ON CONFLICT (youtube_video_id) DO UPDATE SET title = EXCLUDED.title, thumbnail = EXCLUDED.thumbnail
        `
        const [video] = await sql`SELECT id FROM videos WHERE youtube_video_id = ${item.videoId}`
        order += 1
        const status = hasPlaying.length === 0 && !firstAdded ? 'playing' : 'queued'
        await sql`INSERT INTO queue (room_id, video_id, queue_order, status, requested_by) VALUES (${room.id}, ${video.id}, ${order}, ${status}, ${requested_by})`
        firstAdded = true
      }

      notifyQueueUpdate(room.code)
      return NextResponse.json({ batch: true, added: items.length }, { status: 201 })
    }

    // ── Single video ──────────────────────────────────────────────────────
    const videoId = extractVideoId(youtube_url)
    if (!videoId) return NextResponse.json({ error: 'Invalid YouTube URL or video ID' }, { status: 400 })

    const existing = await sql`SELECT id FROM videos WHERE youtube_video_id = ${videoId}`
    let videoDbId: number
    if (existing.length > 0) {
      videoDbId = existing[0].id as number
    } else {
      const meta = await fetchYouTubeMetadata(videoId)
      const [row] = await sql`
        INSERT INTO videos (youtube_video_id, title, thumbnail)
        VALUES (${videoId}, ${meta.title}, ${meta.thumbnail})
        RETURNING id
      `
      videoDbId = row.id as number
    }

    const [{ maxorder }] = await sql`
      SELECT COALESCE(MAX(queue_order), 0)::int AS maxorder FROM queue WHERE room_id = ${room.id} AND status != 'done'
    ` as { maxorder: number }[]

    const [newQueue] = await sql`
      INSERT INTO queue (room_id, video_id, queue_order, status, requested_by)
      VALUES (${room.id}, ${videoDbId}, ${maxorder + 1}, 'queued', ${requested_by})
      RETURNING id
    `

    const hasPlaying = await sql`SELECT id FROM queue WHERE room_id = ${room.id} AND status = 'playing' LIMIT 1`
    if (hasPlaying.length === 0) {
      await sql`UPDATE queue SET status = 'playing' WHERE id = ${newQueue.id}`
    }

    const [item] = await sql`
      SELECT q.id, q.video_id, q.queue_order, q.status, q.requested_by, q.created_at,
             v.youtube_video_id, v.title, v.thumbnail, v.duration
      FROM queue q JOIN videos v ON v.id = q.video_id
      WHERE q.id = ${newQueue.id}
    `
    notifyQueueUpdate(room.code)
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    if (err instanceof RoomError) return roomNotFoundResponse()
    console.error(err)
    const message = err instanceof Error ? err.message : 'Failed to add song'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
