'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import type { Playlist, PlaylistItem } from '@/types'

interface PlaylistDetail extends Playlist {
  items: PlaylistItem[]
}

interface Props {
  onLoadToQueue: () => void
}

export default function PlaylistPanel({ onLoadToQueue }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selected, setSelected] = useState<PlaylistDetail | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [msg, setMsg] = useState('')

  const fetchPlaylists = useCallback(async () => {
    const res = await fetch('/api/playlists')
    const data = await res.json()
    setPlaylists(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchPlaylists() }, [fetchPlaylists])

  async function openPlaylist(pl: Playlist) {
    const res = await fetch(`/api/playlists/${pl.id}`)
    const data = await res.json()
    setSelected(data)
  }

  async function createPlaylist(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
    })
    setNewName('')
    setNewDesc('')
    setCreating(false)
    fetchPlaylists()
  }

  async function deletePlaylist(id: number) {
    if (!confirm('ลบ playlist นี้?')) return
    await fetch(`/api/playlists/${id}`, { method: 'DELETE' })
    if (selected?.id === id) setSelected(null)
    fetchPlaylists()
  }

  async function removeItem(playlistId: number, itemId: number) {
    await fetch(`/api/playlists/${playlistId}/items/${itemId}`, { method: 'DELETE' })
    const res = await fetch(`/api/playlists/${playlistId}`)
    setSelected(await res.json())
    fetchPlaylists()
  }

  async function loadToQueue(playlistId: number) {
    setLoadingId(playlistId)
    setMsg('')
    try {
      const res = await fetch(`/api/playlists/${playlistId}/load`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setMsg(`✅ โหลด ${data.added} เพลงลงคิวแล้ว`)
        onLoadToQueue()
      } else {
        setMsg(`❌ ${data.error}`)
      }
    } finally {
      setLoadingId(null)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  // ---- Detail view ----
  if (selected) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          <button
            onClick={() => setSelected(null)}
            className="text-gray-400 hover:text-white text-sm"
          >
            ← กลับ
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate">{selected.name}</p>
            {selected.description && (
              <p className="text-xs text-gray-500 truncate">{selected.description}</p>
            )}
          </div>
          <button
            onClick={() => loadToQueue(selected.id)}
            disabled={loadingId === selected.id || selected.items.length === 0}
            className="flex-shrink-0 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            {loadingId === selected.id ? '⏳' : '▶ โหลดลงคิว'}
          </button>
        </div>

        {msg && (
          <p className="text-xs px-4 py-2 bg-gray-800 text-green-400">{msg}</p>
        )}

        {selected.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-gray-500 gap-2">
            <span className="text-3xl">🎵</span>
            <p className="text-sm">ยังไม่มีเพลง</p>
            <p className="text-xs text-gray-600">กดไอคอน 💾 ที่เพลงในคิวเพื่อบันทึก</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5 overflow-y-auto flex-1 p-3">
            {selected.items.map((item, i) => (
              <li key={item.id} className="flex items-center gap-3 p-2 rounded-xl bg-gray-800/50 border border-gray-700 group">
                <span className="text-gray-600 text-xs w-5 text-center">{i + 1}</span>
                <div className="relative w-12 h-9 flex-shrink-0 rounded overflow-hidden bg-gray-700">
                  <Image src={item.thumbnail} alt={item.title} fill sizes="48px" className="object-cover" unoptimized />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{item.title}</p>
                </div>
                <button
                  onClick={() => removeItem(selected.id, item.id)}
                  className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs"
                  title="ลบออกจาก playlist"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // ---- List view ----
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="text-sm font-semibold text-gray-200">เพลย์ลิสต์</span>
        <button
          onClick={() => setCreating((v) => !v)}
          className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          {creating ? '✕ ยกเลิก' : '＋ สร้างใหม่'}
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <form onSubmit={createPlaylist} className="flex flex-col gap-2 p-3 border-b border-gray-800 bg-gray-900/60">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ชื่อ playlist *"
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm"
            autoFocus
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="คำอธิบาย (ถ้ามี)"
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm py-2 rounded-lg transition-colors"
          >
            สร้าง Playlist
          </button>
        </form>
      )}

      {msg && <p className="text-xs px-4 py-2 bg-gray-800 text-green-400">{msg}</p>}

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-gray-500 text-sm gap-2">
          <span className="animate-spin">⏳</span> กำลังโหลด...
        </div>
      ) : playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-500 gap-2">
          <span className="text-4xl">📋</span>
          <p className="text-sm">ยังไม่มี playlist</p>
          <p className="text-xs text-gray-600">กด "＋ สร้างใหม่" เพื่อเริ่ม</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 overflow-y-auto flex-1 p-3">
          {playlists.map((pl) => (
            <li
              key={pl.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/60 border border-gray-700 hover:border-gray-500 group cursor-pointer"
              onClick={() => openPlaylist(pl)}
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-xl flex-shrink-0">
                📋
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">{pl.name}</p>
                <p className="text-xs text-gray-500">
                  {pl.item_count} เพลง
                  {pl.description ? ` · ${pl.description}` : ''}
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); loadToQueue(pl.id) }}
                  disabled={loadingId === pl.id || pl.item_count === 0}
                  title="โหลดลงคิว"
                  className="p-1.5 rounded-lg bg-green-700/40 hover:bg-green-600 text-green-300 hover:text-white disabled:opacity-30 transition-colors text-xs opacity-0 group-hover:opacity-100"
                >
                  ▶
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deletePlaylist(pl.id) }}
                  title="ลบ playlist"
                  className="p-1.5 rounded-lg bg-gray-700 hover:bg-red-700 text-gray-400 hover:text-white transition-colors text-xs opacity-0 group-hover:opacity-100"
                >
                  🗑
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
