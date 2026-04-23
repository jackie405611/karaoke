import { NextRequest, NextResponse } from 'next/server'

type QueueState = {
  queueVersion: number
  queueHash: string
}

type SqlClient = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>

export async function getQueueState(sql: SqlClient, roomId: number): Promise<QueueState> {
  const [meta] = await sql`
    SELECT
      COUNT(*)::int AS queue_count,
      COALESCE(
        md5(string_agg((q.id::text || ':' || q.status || ':' || q.queue_order::text), ',' ORDER BY q.queue_order ASC)),
        md5('empty')
      ) AS queue_hash
    FROM queue q
    WHERE q.room_id = ${roomId} AND q.status != 'done'
  ` as { queue_count: number; queue_hash: string }[]

  return {
    queueVersion: Number(meta.queue_count),
    queueHash: meta.queue_hash,
  }
}

export function attachQueueStateHeaders(res: NextResponse, state: QueueState) {
  res.headers.set('X-Queue-Version', String(state.queueVersion))
  res.headers.set('X-Queue-Hash', state.queueHash)
  return res
}

export async function checkQueuePrecondition(req: NextRequest, sql: SqlClient, roomId: number) {
  const expectedHash = req.headers.get('x-queue-hash')?.trim()
  if (!expectedHash) return null

  const state = await getQueueState(sql, roomId)
  if (state.queueHash === expectedHash) return null

  const conflict = NextResponse.json(
    {
      error: 'Queue state conflict',
      code: 'QUEUE_CONFLICT',
      queue_hash: state.queueHash,
      queue_version: state.queueVersion,
    },
    { status: 409 }
  )
  return attachQueueStateHeaders(conflict, state)
}
