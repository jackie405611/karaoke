'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { useQueue } from '@/hooks/useQueue'
import SearchPanel from '@/components/SearchPanel'
import PlaylistPanel from '@/components/PlaylistPanel'
import SaveToPlaylistModal from '@/components/SaveToPlaylistModal'
import type { QueueItem } from '@/types'

type Tab = 'queue' | 'search' | 'playlist'

async function playerCmd(action: string) {
  await fetch('/api/player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
}

export default function RemotePage() {
  const { queue, loading, fetchQueue } = useQueue()
  const [tab, setTab] = useState<Tab>('queue')
  const [requester, setRequester] = useState('')
  const [url, setUrl] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [saveTarget, setSaveTarget] = useState<QueueItem | null>(null)
  const [isPlaying, setIsPlaying] = useState(true) // optimistic UI

  const currentSong = queue.find((q) => q.status === 'playing') ?? null
  const hasNext = queue.some((q) => q.status === 'queued')
  const hasPrev = queue.some((q) => q.status === 'done')

  async function handlePlayPause() {
    const next = !isPlaying
    setIsPlaying(next)
    await playerCmd(next ? 'play' : 'pause')
  }

  async function handleNext() {
    await playerCmd('next')
  }

  async function handlePrev() {
    await playerCmd('prev')
  }

  async function handlePlayNow(id: number) {
    await fetch(`/api/queue/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'play_now' }),
    })
  }

  async function handleRemove(id: number) {
    await fetch(`/api/queue/${id}`, { method: 'DELETE' })
  }

  async function handleAddUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setAddLoading(true)
    setAddError('')
    setAddSuccess('')
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtube_url: url.trim(), requested_by: requester.trim() || 'Guest' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddError(data.error ?? data.message ?? 'เกิดข้อผิดพลาด')
      } else {
        setUrl('')
        setAddSuccess(data.batch ? `✅ เพิ่ม ${data.added} เพลงแล้ว` : '✅ เพิ่มเพลงแล้ว')
        setTimeout(() => setAddSuccess(''), 3000)
        setTab('queue')
      }
    } catch {
      setAddError('ไม่สามารถเชื่อมต่อได้')
    } finally {
      setAddLoading(false)
    }
  }

  const handleAddFromSearch = useCallback(async (videoId: string) => {
    const res = await fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtube_url: videoId, requested_by: requester.trim() || 'Guest' }),
    })
    if (!res.ok) throw new Error('Failed')
    fetchQueue()
  }, [requester, fetchQueue])

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col max-w-lg mx-auto">
      {/* Now Playing Bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xl">🎤</span>
          <div className="flex-1 min-w-0">
            {currentSong ? (
              <>
                <p className="text-white font-semibold text-sm truncate">{currentSong.title}</p>
                <p className="text-gray-500 text-xs">🎤 {currentSong.requested_by}</p>
              </>
            ) : (
              <p className="text-gray-500 text-sm">ยังไม่มีเพลงที่กำลังเล่น</p>
            )}
          </div>
          {/* Requester input */}
          <input
            type="text"
            value={requester}
            onChange={(e) => setRequester(e.target.value)}
            placeholder="ชื่อคุณ"
            className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-red-500"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handlePrev}
            disabled={!hasPrev}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white text-xl transition-colors active:scale-95"
          >
            ⏮
          </button>
          <button
            onClick={handlePlayPause}
            className="w-16 h-16 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-500 text-white text-2xl shadow-lg shadow-red-900/50 transition-colors active:scale-95"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={handleNext}
            disabled={!hasNext}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white text-xl transition-colors active:scale-95"
          >
            ⏭
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* Queue tab */}
        {tab === 'queue' && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {/* Add song quick input */}
            <form onSubmit={handleAddUrl} className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="วาง YouTube URL หรือ Playlist..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500"
                disabled={addLoading}
              />
              <button
                type="submit"
                disabled={addLoading || !url.trim()}
                className="bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white text-sm px-3 rounded-lg transition-colors active:scale-95"
              >
                {addLoading ? '⏳' : '＋'}
              </button>
            </form>
            {addError && <p className="text-red-400 text-xs">{addError}</p>}
            {addSuccess && <p className="text-green-400 text-xs">{addSuccess}</p>}

            {/* Queue list */}
            {loading ? (
              <div className="flex items-center justify-center h-32 text-gray-500 gap-2 text-sm">
                <span className="animate-spin">⏳</span> กำลังโหลด...
              </div>
            ) : queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500 gap-2">
                <span className="text-3xl">🎵</span>
                <p className="text-sm">คิวว่างอยู่</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {queue.map((item, index) => {
                  const isNowPlaying = item.status === 'playing'
                  return (
                    <li
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        isNowPlaying
                          ? 'bg-red-900/40 border-red-500'
                          : 'bg-gray-800/60 border-gray-700'
                      }`}
                    >
                      <div className="w-6 text-center flex-shrink-0">
                        {isNowPlaying
                          ? <span className="text-red-400 animate-pulse">▶</span>
                          : <span className="text-gray-500 text-sm">{index + 1}</span>
                        }
                      </div>
                      <div className="relative w-12 h-9 flex-shrink-0 rounded overflow-hidden bg-gray-700">
                        <Image src={item.thumbnail} alt={item.title} fill sizes="48px" className="object-cover" unoptimized />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 truncate font-medium">{item.title}</p>
                        <p className="text-xs text-gray-500">🎤 {item.requested_by}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {!isNowPlaying && (
                          <button
                            onClick={() => handlePlayNow(item.id)}
                            className="p-2 rounded-lg bg-green-700/50 hover:bg-green-600 text-green-300 text-xs active:scale-95 transition-colors"
                          >▶▶</button>
                        )}
                        <button
                          onClick={() => setSaveTarget(item)}
                          className="p-2 rounded-lg bg-gray-700 hover:bg-blue-700 text-gray-400 text-xs active:scale-95 transition-colors"
                        >💾</button>
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="p-2 rounded-lg bg-gray-700 hover:bg-red-700 text-gray-400 text-xs active:scale-95 transition-colors"
                        >✕</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {/* Search tab */}
        {tab === 'search' && (
          <div className="flex-1 overflow-y-auto p-4">
            <SearchPanel onAddSong={handleAddFromSearch} />
          </div>
        )}

        {/* Playlist tab */}
        {tab === 'playlist' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <PlaylistPanel onLoadToQueue={fetchQueue} />
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="border-t border-gray-800 bg-gray-900 flex safe-area-pb">
        {([
          { id: 'queue', label: '🎵 คิว', badge: queue.filter(q => q.status !== 'done').length },
          { id: 'search', label: '🔍 ค้นหา', badge: 0 },
          { id: 'playlist', label: '📋 Playlist', badge: 0 },
        ] as { id: Tab; label: string; badge: number }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-xs font-medium transition-colors ${
              tab === t.id ? 'text-red-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className="text-base relative">
              {t.label}
              {t.badge > 0 && (
                <span className="ml-1 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 align-top">
                  {t.badge}
                </span>
              )}
            </span>
          </button>
        ))}
      </nav>

      {saveTarget && (
        <SaveToPlaylistModal song={saveTarget} onClose={() => setSaveTarget(null)} />
      )}
    </div>
  )
}
