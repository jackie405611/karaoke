'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const router = useRouter()

  // Create room
  const [roomName, setRoomName]       = useState('')
  const [creating, setCreating]       = useState(false)
  const [createError, setCreateError] = useState('')

  // Join room
  const [joinCode, setJoinCode]       = useState('')
  const [joining, setJoining]         = useState(false)
  const [joinError, setJoinError]     = useState('')
  const joinInputRef = useRef<HTMLInputElement>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error ?? 'เกิดข้อผิดพลาด')
      } else {
        router.push(`/${data.code}`)
      }
    } catch {
      setCreateError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code || code.length !== 6) {
      setJoinError('กรุณากรอกรหัสห้อง 6 หลัก')
      return
    }
    setJoining(true)
    setJoinError('')
    try {
      const res = await fetch(`/api/rooms/${code}`)
      if (!res.ok) {
        setJoinError('ไม่พบห้องนี้ กรุณาตรวจสอบรหัสอีกครั้ง')
      } else {
        router.push(`/${code}/remote`)
      }
    } catch {
      setJoinError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mb-10">
        <span className="text-6xl">🎤</span>
        <h1 className="text-3xl font-bold tracking-wide">YouTube Karaoke</h1>
        <p className="text-gray-500 text-sm text-center">สร้างห้องของคุณหรือเข้าร่วมห้องที่มีอยู่</p>
      </div>

      <div className="w-full max-w-lg flex flex-col gap-5">

        {/* Create Room */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-1">สร้างห้องใหม่</h2>
          <p className="text-gray-500 text-xs mb-4">คุณจะเป็น host และได้รับรหัสห้องสำหรับแชร์</p>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="ชื่อห้อง (ไม่บังคับ เช่น งานวันเกิดจ๊ะ)"
              className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition text-sm"
              maxLength={100}
            />
            {createError && <p className="text-red-400 text-xs">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {creating ? '⏳ กำลังสร้าง...' : '🎤 สร้างห้อง'}
            </button>
          </form>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-600 text-xs">หรือ</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* Join Room */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-1">เข้าร่วมห้อง</h2>
          <p className="text-gray-500 text-xs mb-4">กรอกรหัสห้อง 6 หลักที่ได้รับจาก host</p>
          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <input
              ref={joinInputRef}
              type="text"
              value={joinCode}
              onChange={(e) => {
                const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
                setJoinCode(v)
                setJoinError('')
              }}
              placeholder="เช่น ABC123"
              className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition text-sm font-mono tracking-widest text-center uppercase"
              maxLength={6}
              autoComplete="off"
            />
            {joinError && <p className="text-red-400 text-xs">{joinError}</p>}
            <button
              type="submit"
              disabled={joining || joinCode.length !== 6}
              className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {joining ? '⏳ กำลังเข้าร่วม...' : '▶ เข้าร่วมห้อง'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
