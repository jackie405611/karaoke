import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // excludes confusable 0/O, 1/I

function generateCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return code
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = (body.name ?? '').trim().slice(0, 100)

    const sql = getDb()

    // Generate unique room code (retry on collision)
    let code = ''
    for (let attempt = 0; attempt < 10; attempt++) {
      code = generateCode()
      const existing = await sql`SELECT id FROM rooms WHERE code = ${code}`
      if (existing.length === 0) break
    }

    // Generate host token (random UUID stripped of dashes → 32 hex chars)
    const [{ token }] = await sql`SELECT replace(gen_random_uuid()::text, '-', '') AS token` as { token: string }[]

    await sql`INSERT INTO rooms (code, host_token, name) VALUES (${code}, ${token}, ${name})`

    // Also create the initial player_state row for this room
    await sql`
      INSERT INTO player_state (room_id)
      SELECT id FROM rooms WHERE code = ${code}
      ON CONFLICT DO NOTHING
    `

    const response = NextResponse.json({ code }, { status: 201 })
    response.cookies.set(`karaoke_host_${code}`, token, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: `/${code}`,
    })
    return response
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
  }
}
