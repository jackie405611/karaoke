import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sql = getDb()
    const [playlist] = await sql`SELECT * FROM playlists WHERE id = ${Number(id)}`
    if (!playlist) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const items = await sql`
      SELECT pi.id, pi.playlist_id, pi.video_id, pi.item_order, pi.created_at,
             v.youtube_video_id, v.title, v.thumbnail, v.duration
      FROM playlist_items pi JOIN videos v ON v.id = pi.video_id
      WHERE pi.playlist_id = ${Number(id)} ORDER BY pi.item_order ASC
    `
    return NextResponse.json({ ...playlist, items })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch playlist' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name, description } = await req.json()
    const sql = getDb()
    if (name !== undefined) await sql`UPDATE playlists SET name = ${name.trim()} WHERE id = ${Number(id)}`
    if (description !== undefined) await sql`UPDATE playlists SET description = ${description.trim()} WHERE id = ${Number(id)}`
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sql = getDb()
    await sql`DELETE FROM playlists WHERE id = ${Number(id)}`
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
