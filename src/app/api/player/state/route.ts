import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sql = getDb()
    await sql`INSERT INTO player_state (id, command, seq) VALUES (1, 'play', 0) ON CONFLICT DO NOTHING`
    const [row] = await sql`SELECT command, seq FROM player_state WHERE id = 1`
    return NextResponse.json({ command: row.command, seq: Number(row.seq) })
  } catch {
    // Table not yet migrated — return a stable sentinel so the poller never fires
    return NextResponse.json({ command: 'play', seq: 0 })
  }
}
