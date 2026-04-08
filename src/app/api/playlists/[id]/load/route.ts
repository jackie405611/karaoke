import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { notifyQueueUpdate } from '@/lib/events'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sql = getDb()

    const items = await sql`
      SELECT pi.video_id FROM playlist_items pi
      WHERE pi.playlist_id = ${Number(id)} ORDER BY pi.item_order ASC
    `
    if (items.length === 0) return NextResponse.json({ error: 'Playlist is empty' }, { status: 400 })

    const [{ m: maxOrder }] = await sql`
      SELECT COALESCE(MAX(queue_order), 0)::int AS m FROM queue WHERE status != 'done'
    ` as { m: number }[]
    const hasPlaying = await sql`SELECT id FROM queue WHERE status = 'playing' LIMIT 1`

    let order = maxOrder
    let firstAdded = false
    for (const item of items) {
      order += 1
      const status = hasPlaying.length === 0 && !firstAdded ? 'playing' : 'queued'
      await sql`INSERT INTO queue (video_id, queue_order, status, requested_by) VALUES (${item.video_id}, ${order}, ${status}, 'Playlist')`
      firstAdded = true
    }

    notifyQueueUpdate()
    return NextResponse.json({ added: items.length })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load playlist' }, { status: 500 })
  }
}
