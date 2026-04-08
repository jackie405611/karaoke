import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sql = getDb()
    const rows = await sql`
      SELECT p.id, p.name, p.description, p.created_at,
             COUNT(pi.id)::int AS item_count
      FROM playlists p
      LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
      GROUP BY p.id ORDER BY p.created_at DESC
    `
    return NextResponse.json(rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch playlists' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, description = '' } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const sql = getDb()
    const [playlist] = await sql`
      INSERT INTO playlists (name, description) VALUES (${name.trim()}, ${description.trim()})
      RETURNING id, name, description, created_at, 0::int AS item_count
    `
    return NextResponse.json(playlist, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create playlist' }, { status: 500 })
  }
}
