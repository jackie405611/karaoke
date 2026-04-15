import { getDb } from './db'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export interface RoomRow {
  id: number
  code: string
  host_token: string
  name: string
  last_active_at: string
}

export class RoomError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/** Looks up a room by code (case-insensitive). Throws RoomError if not found or expired. */
export async function getRoomByCode(code: string | null | undefined): Promise<RoomRow> {
  if (!code || !/^[A-Za-z0-9]{6}$/.test(code)) {
    throw new RoomError(404, 'ไม่พบห้องนี้')
  }
  const sql = getDb()
  const rows = await sql`
    SELECT id, code, host_token, name, last_active_at
    FROM rooms
    WHERE code = ${code.toUpperCase()}
      AND last_active_at > NOW() - INTERVAL '24 hours'
  `
  if (rows.length === 0) throw new RoomError(404, 'ห้องนี้หมดอายุหรือไม่มีอยู่')
  const room = rows[0] as unknown as RoomRow

  // Touch last_active_at in background (non-blocking)
  sql`UPDATE rooms SET last_active_at = NOW() WHERE id = ${room.id}`.catch(() => {})

  return room
}

/** Returns the host token cookie value for a given room, or null. */
export function getHostToken(req: NextRequest, roomCode: string): string | null {
  return req.cookies.get(`karaoke_host_${roomCode.toUpperCase()}`)?.value ?? null
}

/** Returns true if the request carries a valid host token for the room. */
export function isHost(room: RoomRow, req: NextRequest): boolean {
  const token = getHostToken(req, room.code)
  return token !== null && token === room.host_token
}

export function roomNotFoundResponse() {
  return NextResponse.json({ error: 'ไม่พบห้องนี้หรือห้องหมดอายุแล้ว' }, { status: 404 })
}

export function forbiddenResponse() {
  return NextResponse.json({ error: 'ต้องเป็น host เท่านั้น' }, { status: 403 })
}
