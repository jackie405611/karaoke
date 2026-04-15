import { getRoomByCode, RoomError } from '@/lib/rooms'
import Link from 'next/link'

export default async function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ roomCode: string }>
}) {
  const { roomCode } = await params

  try {
    await getRoomByCode(roomCode)
  } catch (err) {
    if (err instanceof RoomError) {
      return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4 p-6">
          <span className="text-6xl">🎤</span>
          <p className="text-2xl font-bold">ไม่พบห้องนี้</p>
          <p className="text-gray-500 text-sm text-center">
            ห้องรหัส <span className="font-mono text-gray-300">{roomCode.toUpperCase()}</span> หมดอายุแล้วหรือไม่มีอยู่
          </p>
          <Link
            href="/"
            className="mt-2 bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-lg transition-colors font-medium"
          >
            สร้างห้องใหม่
          </Link>
        </div>
      )
    }
    throw err
  }

  return <>{children}</>
}
