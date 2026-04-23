import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { notifyQueueUpdate } from '@/lib/events'
import { getRoomByCode, RoomError, roomNotFoundResponse } from '@/lib/rooms'
import { checkDedupe, checkRateLimit, getClientFingerprint } from '@/lib/requestGuard'
import { attachQueueStateHeaders, checkQueuePrecondition, getQueueState } from '@/lib/queueState'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const room = await getRoomByCode(req.nextUrl.searchParams.get('room'))
    const actor = getClientFingerprint(req.headers.get('x-forwarded-for'), req.headers.get('user-agent'))

    const rate = checkRateLimit({
      roomCode: room.code,
      actor,
      action: 'queue:reorder',
      maxRequests: 16,
      windowMs: 10_000,
    })
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 })
    }

    const dedupe = checkDedupe({
      roomCode: room.code,
      actor,
      action: 'queue:reorder',
      dedupeWindowMs: 250,
    })
    if (!dedupe.allowed) {
      return NextResponse.json({ error: 'Duplicate request ignored.' }, { status: 409 })
    }

    const sql = getDb()
    const precondition = await checkQueuePrecondition(req, sql, Number(room.id))
    if (precondition) return precondition

    const body = await req.json() as { ordered_ids?: number[] }
    const orderedIds = Array.isArray(body.ordered_ids)
      ? body.ordered_ids.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0)
      : []

    const currentQueued = await sql`
      SELECT id
      FROM queue
      WHERE room_id = ${room.id} AND status = 'queued'
      ORDER BY queue_order ASC
    ` as { id: number }[]

    if (orderedIds.length !== currentQueued.length) {
      const state = await getQueueState(sql, Number(room.id))
      return attachQueueStateHeaders(
        NextResponse.json({ error: 'Queued items changed. Refresh and retry.', code: 'QUEUE_REORDER_STALE' }, { status: 409 }),
        state
      )
    }

    const currentSet = new Set(currentQueued.map((r) => Number(r.id)))
    const requestedSet = new Set(orderedIds)
    if (currentSet.size !== requestedSet.size || [...currentSet].some((id) => !requestedSet.has(id))) {
      const state = await getQueueState(sql, Number(room.id))
      return attachQueueStateHeaders(
        NextResponse.json({ error: 'Queued items changed. Refresh and retry.', code: 'QUEUE_REORDER_STALE' }, { status: 409 }),
        state
      )
    }

    if (orderedIds.length > 0) {
      await sql`
        WITH payload AS (
          SELECT *
          FROM unnest(${orderedIds}::bigint[]) WITH ORDINALITY AS t(id, ord)
        )
        UPDATE queue q
        SET queue_order = payload.ord
        FROM payload
        WHERE q.id = payload.id
          AND q.room_id = ${room.id}
          AND q.status = 'queued'
      `
      notifyQueueUpdate(room.code)
    }

    const state = await getQueueState(sql, Number(room.id))
    return attachQueueStateHeaders(NextResponse.json({ success: true }), state)
  } catch (err) {
    if (err instanceof RoomError) return roomNotFoundResponse()
    console.error(err)
    return NextResponse.json({ error: 'Failed to reorder queue' }, { status: 500 })
  }
}
