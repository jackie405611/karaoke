import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRoomByCode, RoomError, roomNotFoundResponse } from '@/lib/rooms'

export const dynamic = 'force-dynamic'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const room = await getRoomByCode(req.nextUrl.searchParams.get('room'))
    const { id, itemId } = await params
    const sql = getDb()
    // Verify playlist belongs to room before deleting
    const [playlist] = await sql`SELECT id FROM playlists WHERE id = ${Number(id)} AND room_id = ${room.id}`
    if (!playlist) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await sql`DELETE FROM playlist_items WHERE id = ${Number(itemId)} AND playlist_id = ${Number(id)}`
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof RoomError) return roomNotFoundResponse()
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
