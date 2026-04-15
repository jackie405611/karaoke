'use client'

import { useState, useEffect } from 'react'
import type { Playlist, QueueItem } from '@/types'

interface Props {
  roomCode: string
  song: QueueItem
  onClose: () => void
}

export default function SaveToPlaylistModal({ roomCode, song, onClose }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [savingId, setSavingId] = useState<number | null>(null)
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set())
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    fetch(`/api/playlists?room=${roomCode}`).then((r) => r.json()).then(setPlaylists)
  }, [roomCode])

  async function save(playlistId: number) {
    setSavingId(playlistId)
    setErrors((prev) => { const e = { ...prev }; delete e[playlistId]; return e })
    try {
      const res = await fetch(`/api/playlists/${playlistId}/items?room=${roomCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: song.video_id }),
      })
      if (res.ok) {
        setSavedIds((prev) => new Set(prev).add(playlistId))
        setPlaylists((prev) =>
          prev.map((p) => p.id === playlistId ? { ...p, item_count: p.item_count + 1 } : p)
        )
      } else {
        const data = await res.json()
        setErrors((prev) => ({ ...prev, [playlistId]: data.error ?? 'เกิดข้อผิดพลาด' }))
      }
    } finally {
      setSavingId(null)
    }
  }

  async function createAndSave(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const res = await fetch(`/api/playlists?room=${roomCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const pl = await res.json()
    setPlaylists((prev) => [pl, ...prev])
    setNewName('')
    setCreating(false)
    save(pl.id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-80 shadow-2xl flex flex-col gap-4 max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-base font-bold text-white">💾 บันทึกลง Playlist</h3>
          <p className="text-xs text-gray-400 truncate mt-0.5">{song.title}</p>
        </div>

        {creating ? (
          <form onSubmit={createAndSave} className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ชื่อ playlist ใหม่"
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
              autoFocus
            />
            <button type="submit" disabled={!newName.trim()}
              className="bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white text-sm px-3 rounded-lg transition-colors">
              ＋
            </button>
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 hover:border-red-500 transition-colors text-sm text-gray-400 hover:text-white"
          >
            <span className="text-lg">＋</span> สร้าง playlist ใหม่
          </button>
        )}

        <ul className="flex flex-col gap-1.5 overflow-y-auto">
          {playlists.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-4">ยังไม่มี playlist</p>
          )}
          {playlists.map((pl) => {
            const isSaved = savedIds.has(pl.id)
            const isSaving = savingId === pl.id
            const errMsg = errors[pl.id]
            return (
              <li key={pl.id}>
                <button
                  onClick={() => !isSaved && save(pl.id)}
                  disabled={isSaving || isSaved}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                    isSaved
                      ? 'bg-green-900/30 border-green-700 cursor-default'
                      : 'bg-gray-800 border-gray-700 hover:border-red-500 hover:bg-gray-750 cursor-pointer'
                  }`}
                >
                  <span className="text-lg">📋</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{pl.name}</p>
                    <p className="text-xs text-gray-500">{pl.item_count} เพลง</p>
                  </div>
                  <span className="text-sm flex-shrink-0">
                    {isSaving ? '⏳' : isSaved ? '✅' : ''}
                  </span>
                </button>
                {errMsg && (
                  <p className="text-xs text-red-400 px-3 mt-0.5">{errMsg}</p>
                )}
              </li>
            )
          })}
        </ul>

        <button
          onClick={onClose}
          className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm transition-colors"
        >
          ปิด
        </button>
      </div>
    </div>
  )
}
