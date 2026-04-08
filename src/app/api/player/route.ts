import { NextRequest, NextResponse } from 'next/server'
import { notifyPlayerCommand, notifyQueueUpdate } from '@/lib/events'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json()

    if (action === 'play' || action === 'pause') {
      notifyPlayerCommand(action)
      return NextResponse.json({ success: true })
    }

    const sql = getDb()

    if (action === 'next') {
      const playing = await sql`SELECT id FROM queue WHERE status = 'playing' LIMIT 1`
      if (playing.length > 0) {
        await sql`UPDATE queue SET status = 'done' WHERE id = ${playing[0].id}`
        const next = await sql`SELECT id FROM queue WHERE status = 'queued' ORDER BY queue_order ASC LIMIT 1`
        if (next.length > 0) await sql`UPDATE queue SET status = 'playing' WHERE id = ${next[0].id}`
      }
      notifyQueueUpdate()
      return NextResponse.json({ success: true })
    }

    if (action === 'prev') {
      const playing = await sql`SELECT id FROM queue WHERE status = 'playing' LIMIT 1`
      if (playing.length > 0) await sql`UPDATE queue SET status = 'queued' WHERE id = ${playing[0].id}`
      const prev = await sql`SELECT id FROM queue WHERE status = 'done' ORDER BY queue_order DESC LIMIT 1`
      if (prev.length > 0) {
        await sql`UPDATE queue SET status = 'playing' WHERE id = ${prev[0].id}`
      } else if (playing.length > 0) {
        await sql`UPDATE queue SET status = 'playing' WHERE id = ${playing[0].id}`
      }
      notifyQueueUpdate()
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
