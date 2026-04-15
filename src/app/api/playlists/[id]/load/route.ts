import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { notifyQueueUpdate } from '@/lib/events'
import { getRoomByCode, RoomError, roomNotFoundResponse } from '@/lib/rooms'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const room = await getRoomByCode(req.nextUrl.searchParams.get('room'))
    const { id } = await params
    const sql = getDb()

    const [playlist] = await sql`SELECT id FROM playlists WHERE id = ${Number(id)} AND room_id = ${room.id}`
    if (!playlist) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })

    const items = await sql`
      SELECT pi.video_id FROM playlist_items pi
      WHERE pi.playlist_id = ${Number(id)} ORDER BY pi.item_order ASC
    `
    if (items.length === 0) return NextResponse.json({ error: 'Playlist is empty' }, { status: 400 })

    const [{ m: maxOrder }] = await sql`
      SELECT COALESCE(MAX(queue_order), 0)::int AS m FROM queue WHERE room_id = ${room.id} AND status != 'done'
    ` as { m: number }[]
    const hasPlaying = await sql`SELECT id FROM queue WHERE room_id = ${room.id} AND status = 'playing' LIMIT 1`

    let order = maxOrder
    let firstAdded = false
    for (const item of items) {
      order += 1
      const status = hasPlaying.length === 0 && !firstAdded ? 'playing' : 'queued'
      await sql`INSERT INTO queue (room_id, video_id, queue_order, status, requested_by) VALUES (${room.id}, ${item.video_id}, ${order}, ${status}, 'Playlist')`
      firstAdded = true
    }

    notifyQueueUpdate(room.code)
    return NextResponse.json({ added: items.length })
  } catch (err) {
    if (err instanceof RoomError) return roomNotFoundResponse()
    console.error(err)
    return NextResponse.json({ error: 'Failed to load playlist' }, { status: 500 })
  }
}
