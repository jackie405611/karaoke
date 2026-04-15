import { NextRequest, NextResponse } from 'next/server'
import { getRoomByCode, RoomError } from '@/lib/rooms'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const room = await getRoomByCode(code)
    return NextResponse.json({ code: room.code, name: room.name })
  } catch (err) {
    if (err instanceof RoomError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
