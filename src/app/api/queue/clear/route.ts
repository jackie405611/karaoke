import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function DELETE() {
  try {
    const sql = getDb()
    await sql`DELETE FROM queue WHERE status IN ('done', 'queued')`
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to clear' }, { status: 500 })
  }
}
