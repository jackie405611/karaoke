import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { notifyQueueUpdate } from '@/lib/events'
import { getRoomByCode, RoomError, roomNotFoundResponse } from '@/lib/rooms'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const room = await getRoomByCode(req.nextUrl.searchParams.get('room'))
    const { id } = await params
    const sql = getDb()

    const [item] = await sql`SELECT status FROM queue WHERE id = ${Number(id)} AND room_id = ${room.id}`
    await sql`DELETE FROM queue WHERE id = ${Number(id)} AND room_id = ${room.id}`

    // If we deleted the currently playing song, advance to the next queued song
    if (item?.status === 'playing') {
      const next = await sql`
        SELECT id FROM queue WHERE room_id = ${room.id} AND status = 'queued'
        ORDER BY queue_order ASC LIMIT 1
      `
      if (next.length > 0) {
        await sql`UPDATE queue SET status = 'playing' WHERE id = ${next[0].id}`
      }
    }

    notifyQueueUpdate(room.code)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof RoomError) return roomNotFoundResponse()
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const room = await getRoomByCode(req.nextUrl.searchParams.get('room'))
    const { id } = await params
    const { action } = await req.json()
    const sql = getDb()

    if (action === 'play_now') {
      await sql`UPDATE queue SET status = 'done' WHERE room_id = ${room.id} AND status = 'playing'`
      await sql`UPDATE queue SET status = 'playing' WHERE id = ${Number(id)} AND room_id = ${room.id}`
      notifyQueueUpdate(room.code)
      const [item] = await sql`
        SELECT q.id, q.video_id, q.queue_order, q.status, q.requested_by, q.created_at,
               v.youtube_video_id, v.title, v.thumbnail, v.duration
        FROM queue q JOIN videos v ON v.id = q.video_id WHERE q.id = ${Number(id)}
      `
      return NextResponse.json(item)
    }

    if (action === 'next') {
      await sql`UPDATE queue SET status = 'done' WHERE room_id = ${room.id} AND status = 'playing'`
      const next = await sql`
        SELECT q.id, q.video_id, q.queue_order, q.status, q.requested_by, q.created_at,
               v.youtube_video_id, v.title, v.thumbnail, v.duration
        FROM queue q JOIN videos v ON v.id = q.video_id
        WHERE q.room_id = ${room.id} AND q.status = 'queued' ORDER BY q.queue_order ASC LIMIT 1
      `
      if (next.length > 0) {
        await sql`UPDATE queue SET status = 'playing' WHERE id = ${next[0].id}`
      }
      notifyQueueUpdate(room.code)
      return NextResponse.json(next.length > 0 ? { ...next[0], status: 'playing' } : { done: true })
    }

    if (action === 'prev') {
      const current = await sql`SELECT id FROM queue WHERE room_id = ${room.id} AND status = 'playing' LIMIT 1`
      if (current.length > 0) await sql`UPDATE queue SET status = 'queued' WHERE id = ${current[0].id}`

      const prev = await sql`
        SELECT q.id, q.video_id, q.queue_order, q.status, q.requested_by, q.created_at,
               v.youtube_video_id, v.title, v.thumbnail, v.duration
        FROM queue q JOIN videos v ON v.id = q.video_id
        WHERE q.room_id = ${room.id} AND q.status = 'done' ORDER BY q.queue_order DESC LIMIT 1
      `
      if (prev.length > 0) {
        await sql`UPDATE queue SET status = 'playing' WHERE id = ${prev[0].id}`
      } else if (current.length > 0) {
        await sql`UPDATE queue SET status = 'playing' WHERE id = ${current[0].id}`
      }
      notifyQueueUpdate(room.code)
      return NextResponse.json(prev.length > 0 ? { ...prev[0], status: 'playing' } : { done: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    if (err instanceof RoomError) return roomNotFoundResponse()
    console.error(err)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
