import { NextRequest, NextResponse } from 'next/server'
import { notifyPlayerCommand, notifyQueueUpdate } from '@/lib/events'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json()
    const sql = getDb()

    if (action === 'play' || action === 'pause' || action === 'restart') {
      // Persist to DB so display can poll reliably (EventEmitter is process-local and may miss).
      // Wrapped in try/catch — if player_state table hasn't been migrated yet, EventEmitter fallback still works.
      try {
        await sql`
          INSERT INTO player_state (id, command, seq, updated_at)
          VALUES (1, ${action}, 1, NOW())
          ON CONFLICT (id) DO UPDATE
            SET command    = EXCLUDED.command,
                seq        = player_state.seq + 1,
                updated_at = NOW()
        `
      } catch {
        // table not yet created — graceful degradation to EventEmitter below
      }
      notifyPlayerCommand(action)
      return NextResponse.json({ success: true })
    }

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
