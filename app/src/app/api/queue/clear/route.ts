import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRoomByCode, RoomError, roomNotFoundResponse } from '@/lib/rooms'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest) {
  try {
    const room = await getRoomByCode(req.nextUrl.searchParams.get('room'))
    const sql = getDb()
    await sql`DELETE FROM queue WHERE room_id = ${room.id} AND status IN ('done', 'queued')`
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof RoomError) return roomNotFoundResponse()
    console.error(err)
    return NextResponse.json({ error: 'Failed to clear' }, { status: 500 })
  }
}
