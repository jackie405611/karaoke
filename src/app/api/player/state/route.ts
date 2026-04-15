import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRoomByCode, RoomError } from '@/lib/rooms'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const room = await getRoomByCode(req.nextUrl.searchParams.get('room'))
    const sql = getDb()

    // Ensure a player_state row exists for this room
    await sql`INSERT INTO player_state (room_id) VALUES (${room.id}) ON CONFLICT DO NOTHING`

    const [row] = await sql`SELECT command, seq FROM player_state WHERE room_id = ${room.id}`
    return NextResponse.json({ command: row.command, seq: Number(row.seq) })
  } catch (err) {
    if (err instanceof RoomError) {
      // Return stable sentinel so poller never fires spuriously
      return NextResponse.json({ command: 'play', seq: 0 })
    }
    console.error(err)
    return NextResponse.json({ command: 'play', seq: 0 })
  }
}
