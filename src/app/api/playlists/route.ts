import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRoomByCode, RoomError, roomNotFoundResponse } from '@/lib/rooms'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const room = await getRoomByCode(req.nextUrl.searchParams.get('room'))
    const sql = getDb()
    const rows = await sql`
      SELECT p.id, p.name, p.description, p.created_at,
             COUNT(pi.id)::int AS item_count
      FROM playlists p
      LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
      WHERE p.room_id = ${room.id}
      GROUP BY p.id ORDER BY p.created_at DESC
    `
    return NextResponse.json(rows)
  } catch (err) {
    if (err instanceof RoomError) return roomNotFoundResponse()
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch playlists' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const room = await getRoomByCode(req.nextUrl.searchParams.get('room'))
    const { name, description = '' } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const sql = getDb()
    const [playlist] = await sql`
      INSERT INTO playlists (room_id, name, description) VALUES (${room.id}, ${name.trim()}, ${description.trim()})
      RETURNING id, name, description, created_at, 0::int AS item_count
    `
    return NextResponse.json(playlist, { status: 201 })
  } catch (err) {
    if (err instanceof RoomError) return roomNotFoundResponse()
    console.error(err)
    return NextResponse.json({ error: 'Failed to create playlist' }, { status: 500 })
  }
}
