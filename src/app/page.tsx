'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import AddSongForm from '@/components/AddSongForm'
import QueueList from '@/components/QueueList'
import PlayerControls from '@/components/PlayerControls'
import PlaylistPanel from '@/components/PlaylistPanel'
import SaveToPlaylistModal from '@/components/SaveToPlaylistModal'
import type { QueueItem } from '@/types'

const YoutubePlayer = dynamic(() => import('@/components/YoutubePlayer'), { ssr: false })

const SHORTCUTS = [
  { key: 'Space', label: 'เล่น / หยุด' },
  { key: '→ / N', label: 'เพลงถัดไป' },
  { key: '← / P', label: 'เพลงก่อนหน้า' },
  { key: 'F', label: 'เต็มจอ' },
  { key: '?', label: 'แสดงคีย์ลัด' },
]

export default function Home() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [rightTab, setRightTab] = useState<'queue' | 'playlist'>('queue')
  const [saveTarget, setSaveTarget] = useState<QueueItem | null>(null)
  const [clearingQueue, setClearingQueue] = useState(false)
  const playerRef = useRef<YT.Player | null>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const isPlayingRef = useRef(isPlaying)
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  const currentSong = queue.find((q) => q.status === 'playing') ?? null
  const hasPrev = queue.some((q) => q.status === 'done')
  const hasNext = queue.some((q) => q.status === 'queued')

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/queue')
      const data = await res.json()
      setQueue(data)
    } catch {
      console.error('Failed to fetch queue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
    // SSE for real-time updates from any device
    const es = new EventSource('/api/events')
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'queue-update') fetchQueue()
        if (data.type === 'player-command') {
          if (!playerRef.current) return
          if (data.command === 'play') playerRef.current.playVideo()
          if (data.command === 'pause') playerRef.current.pauseVideo()
        }
      } catch {}
    }
    return () => es.close()
  }, [fetchQueue])

  const handlePlayerReady = useCallback((player: YT.Player) => {
    playerRef.current = player
  }, [])

  const handleNext = useCallback(async () => {
    const playing = queue.find((q) => q.status === 'playing')
    if (!playing) return
    const res = await fetch(`/api/queue/${playing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'next' }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.done) setIsPlaying(false)
    }
    await fetchQueue()
  }, [queue, fetchQueue])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      // Don't fire when typing in input/textarea
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        if (!playerRef.current) return
        if (isPlayingRef.current) playerRef.current.pauseVideo()
        else playerRef.current.playVideo()
      } else if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        handlePrev()
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        handleFullscreen()
      } else if (e.key === '?') {
        setShowShortcuts((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleNext])

  const handleStateChange = useCallback(
    (state: number) => {
      if (state === 1) setIsPlaying(true)
      if (state === 2) setIsPlaying(false)
      if (state === 0) handleNext()
    },
    [handleNext]
  )

  async function handlePrev() {
    const playing = queue.find((q) => q.status === 'playing')
    if (!playing) return
    await fetch(`/api/queue/${playing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'prev' }),
    })
    await fetchQueue()
  }

  function handlePlayPause() {
    if (!playerRef.current) return
    if (isPlaying) {
      playerRef.current.pauseVideo()
    } else {
      playerRef.current.playVideo()
    }
  }

  async function handlePlayNow(id: number) {
    await fetch(`/api/queue/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'play_now' }),
    })
    await fetchQueue()
  }

  async function handleRemove(id: number) {
    await fetch(`/api/queue/${id}`, { method: 'DELETE' })
    await fetchQueue()
  }

  async function handleClearQueue() {
    if (!confirm('ล้างคิวเพลงทั้งหมด? (เพลงที่กำลังเล่นจะยังคงอยู่)')) return
    setClearingQueue(true)
    try {
      await fetch('/api/queue/clear', { method: 'DELETE' })
      await fetchQueue()
    } finally {
      setClearingQueue(false)
    }
  }

  function handleFullscreen() {
    const el = playerContainerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen()
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              ⌨️ คีย์ลัด
            </h3>
            <ul className="flex flex-col gap-2">
              {SHORTCUTS.map((s) => (
                <li key={s.key} className="flex items-center justify-between">
                  <kbd className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm font-mono text-gray-200">
                    {s.key}
                  </kbd>
                  <span className="text-gray-400 text-sm">{s.label}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowShortcuts(false)}
              className="mt-5 w-full bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm transition-colors"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
        <span className="text-2xl">🎤</span>
        <h1 className="text-xl font-bold tracking-wide">YouTube Karaoke</h1>
        {currentSong && (
          <span className="ml-auto text-sm text-gray-400 truncate max-w-xs hidden sm:block">
            ▶ {currentSong.title}
          </span>
        )}
        <button
          onClick={() => setShowShortcuts(true)}
          title="คีย์ลัด (?)"
          className="ml-auto sm:ml-2 text-gray-500 hover:text-gray-300 text-sm border border-gray-700 hover:border-gray-500 rounded-lg px-2.5 py-1 transition-colors"
        >
          ⌨️ ?
        </button>
      </header>

      {/* Add Song Bar */}
      <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/50">
        <AddSongForm onAdded={fetchQueue} />
      </div>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left: Player */}
        <div ref={playerContainerRef} className="flex-1 flex flex-col gap-4 p-6 min-w-0">
          <YoutubePlayer
            videoId={currentSong?.youtube_video_id ?? null}
            onReady={handlePlayerReady}
            onStateChange={handleStateChange}
          />

          {/* Now Playing Info */}
          {currentSong && (
            <div className="flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-3 border border-gray-800">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold truncate">{currentSong.title}</p>
                <p className="text-xs text-gray-500">🎤 {currentSong.requested_by}</p>
              </div>
            </div>
          )}

          {/* Controls */}
          <PlayerControls
            isPlaying={isPlaying}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPlayPause={handlePlayPause}
            onNext={handleNext}
            onPrev={handlePrev}
            onFullscreen={handleFullscreen}
          />
        </div>

        {/* Right: Queue / Playlist */}
        <aside className="w-96 flex flex-col border-l border-gray-800 bg-gray-900/30">
          {/* Tab switcher */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setRightTab('queue')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                rightTab === 'queue'
                  ? 'text-white border-b-2 border-red-500 bg-gray-900/50'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              🎵 คิวเพลง
              {queue.filter((q) => q.status !== 'done').length > 0 && (
                <span className="ml-1.5 text-xs bg-red-600 text-white rounded-full px-1.5 py-0.5">
                  {queue.filter((q) => q.status !== 'done').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setRightTab('playlist')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                rightTab === 'playlist'
                  ? 'text-white border-b-2 border-red-500 bg-gray-900/50'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              📋 เพลย์ลิสต์
            </button>
          </div>

          {/* Queue tab */}
          {rightTab === 'queue' && (
            <div className="flex-1 overflow-y-auto p-4">
              {/* Clear queue button */}
              {queue.some((q) => q.status === 'queued' || q.status === 'done') && (
                <div className="flex justify-end mb-3">
                  <button
                    onClick={handleClearQueue}
                    disabled={clearingQueue}
                    className="text-xs text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-700 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                  >
                    {clearingQueue ? '⏳ กำลังล้าง...' : '🗑 ล้างคิว'}
                  </button>
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-500 gap-2">
                  <span className="animate-spin text-xl">⏳</span>
                  <span className="text-sm">กำลังโหลด...</span>
                </div>
              ) : (
                <QueueList
                  queue={queue}
                  currentId={currentSong?.id ?? null}
                  onPlayNow={handlePlayNow}
                  onRemove={handleRemove}
                  onSaveToPlaylist={(item) => setSaveTarget(item)}
                />
              )}
            </div>
          )}

          {/* Playlist tab */}
          {rightTab === 'playlist' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <PlaylistPanel onLoadToQueue={fetchQueue} />
            </div>
          )}
        </aside>

        {/* Save to Playlist Modal */}
        {saveTarget && (
          <SaveToPlaylistModal
            song={saveTarget}
            onClose={() => setSaveTarget(null)}
          />
        )}
      </main>
    </div>
  )
}
