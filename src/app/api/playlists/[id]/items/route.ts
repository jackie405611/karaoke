import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getRoomByCode, RoomError, roomNotFoundResponse } from '@/lib/rooms'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const room = await getRoomByCode(req.nextUrl.searchParams.get('room'))
    const { id } = await params
    const { video_id } = await req.json()
    if (!video_id) return NextResponse.json({ error: 'video_id is required' }, { status: 400 })

    const sql = getDb()
    const [playlist] = await sql`SELECT id FROM playlists WHERE id = ${Number(id)} AND room_id = ${room.id}`
    if (!playlist) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })

    const [{ m }] = await sql`
      SELECT COALESCE(MAX(item_order), 0)::int AS m FROM playlist_items WHERE playlist_id = ${Number(id)}
    ` as { m: number }[]

    try {
      await sql`
        INSERT INTO playlist_items (playlist_id, video_id, item_order)
        VALUES (${Number(id)}, ${video_id}, ${m + 1})
      `
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '23505') {
        return NextResponse.json({ error: 'เพลงนี้อยู่ใน playlist แล้ว' }, { status: 409 })
      }
      throw e
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    if (err instanceof RoomError) return roomNotFoundResponse()
    console.error(err)
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })
  }
}
