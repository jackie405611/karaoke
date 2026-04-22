import { NextRequest, NextResponse } from 'next/server'
import { notifyPlayerCommand, notifyQueueUpdate, notifyUiCommand } from '@/lib/events'
import { getDb } from '@/lib/db'
import { getRoomByCode, RoomError, roomNotFoundResponse } from '@/lib/rooms'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const room = await getRoomByCode(req.nextUrl.searchParams.get('room'))
    const { action } = await req.json()
    const sql = getDb()

    if (action === 'play' || action === 'pause' || action === 'restart') {
      await sql`
        INSERT INTO player_state (room_id, command, seq, updated_at)
        VALUES (${room.id}, ${action}, 1, NOW())
        ON CONFLICT (room_id) DO UPDATE
          SET command    = EXCLUDED.command,
              seq        = player_state.seq + 1,
              updated_at = NOW()
      `
      notifyPlayerCommand(room.code, action)
      return NextResponse.json({ success: true })
    }

    if (action === 'next') {
      const playing = await sql`SELECT id FROM queue WHERE room_id = ${room.id} AND status = 'playing' LIMIT 1`
      if (playing.length > 0) {
        await sql`UPDATE queue SET status = 'done' WHERE id = ${playing[0].id}`
        const next = await sql`SELECT id FROM queue WHERE room_id = ${room.id} AND status = 'queued' ORDER BY queue_order ASC LIMIT 1`
        if (next.length > 0) await sql`UPDATE queue SET status = 'playing' WHERE id = ${next[0].id}`
      }
      notifyQueueUpdate(room.code)
      return NextResponse.json({ success: true })
    }

    if (action === 'prev') {
      const playing = await sql`SELECT id FROM queue WHERE room_id = ${room.id} AND status = 'playing' LIMIT 1`
      if (playing.length > 0) await sql`UPDATE queue SET status = 'queued' WHERE id = ${playing[0].id}`
      const prev = await sql`SELECT id FROM queue WHERE room_id = ${room.id} AND status = 'done' ORDER BY queue_order DESC LIMIT 1`
      if (prev.length > 0) {
        await sql`UPDATE queue SET status = 'playing' WHERE id = ${prev[0].id}`
      } else if (playing.length > 0) {
        await sql`UPDATE queue SET status = 'playing' WHERE id = ${playing[0].id}`
      }
      notifyQueueUpdate(room.code)
      return NextResponse.json({ success: true })
    }

    if (action === 'toggle_queue') {
      await sql`INSERT INTO player_state (room_id) VALUES (${room.id}) ON CONFLICT DO NOTHING`
      const [state] = await sql`
        UPDATE player_state
        SET queue_visible = NOT queue_visible, updated_at = NOW()
        WHERE room_id = ${room.id}
        RETURNING queue_visible
      `
      notifyUiCommand(room.code, { action: 'queue_visible', visible: state.queue_visible })
      return NextResponse.json({ success: true, queue_visible: state.queue_visible })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    if (err instanceof RoomError) return roomNotFoundResponse()
    console.error(err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
