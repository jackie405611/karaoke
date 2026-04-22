'use client'

import { useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { useRemote } from '@/hooks/useQueue'
import SearchPanel from '@/components/SearchPanel'
import PlaylistPanel from '@/components/PlaylistPanel'
import SaveToPlaylistModal from '@/components/SaveToPlaylistModal'
import type { QueueItem } from '@/types'

type Tab = 'queue' | 'search' | 'playlist'

const NAV_TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'queue',    icon: '♫',  label: 'คิว' },
  { id: 'search',   icon: '◎',  label: 'ค้นหา' },
  { id: 'playlist', icon: '≡',  label: 'Playlist' },
]

export default function RoomRemotePage() {
  const params = useParams<{ roomCode: string }>()
  const roomCode = (params.roomCode ?? '').toUpperCase()

  const { queue, loading, fetchQueue, isPlaying, connected, roomExpired, queueVisible } = useRemote(roomCode)

  const [cmdPending, setCmdPending] = useState(false)
  const [cmdError, setCmdError]     = useState('')
  const cmdErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [tab, setTab]             = useState<Tab>('queue')
  const [requester, setRequester] = useState('')
  const [url, setUrl]             = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError]   = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [saveTarget, setSaveTarget] = useState<QueueItem | null>(null)
  const [clearingQueue, setClearingQueue] = useState(false)
  const [showUrlChoice, setShowUrlChoice] = useState(false)

  const urlIsPlaylist = /[?&]list=[a-zA-Z0-9_-]+/.test(url)
  const currentSong   = queue.find((q) => q.status === 'playing') ?? null
  const hasNext       = queue.some((q) => q.status === 'queued')
  const hasPrev       = queue.some((q) => q.status === 'done')
  const queueCount    = queue.filter((q) => q.status !== 'done').length

  function showCmdError(msg: string) {
    setCmdError(msg)
    if (cmdErrorTimerRef.current) clearTimeout(cmdErrorTimerRef.current)
    cmdErrorTimerRef.current = setTimeout(() => setCmdError(''), 3000)
  }

  async function playerCmd(action: string) {
    const res = await fetch(`/api/player?room=${roomCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (!res.ok) throw new Error('failed')
  }

  async function handlePlayPause() {
    if (cmdPending) return
    setCmdPending(true)
    try {
      await playerCmd(isPlaying ? 'pause' : 'play')
    } catch {
      showCmdError('คำสั่งไม่สำเร็จ ลองใหม่')
    } finally {
      setCmdPending(false)
    }
  }

  async function handleNext() {
    if (cmdPending || !hasNext) return
    setCmdPending(true)
    try {
      await playerCmd('next')
      fetchQueue()
    } catch {
      showCmdError('คำสั่งไม่สำเร็จ ลองใหม่')
    } finally {
      setCmdPending(false)
    }
  }

  async function handlePrev() {
    if (cmdPending || !hasPrev) return
    setCmdPending(true)
    try {
      await playerCmd('prev')
      fetchQueue()
    } catch {
      showCmdError('คำสั่งไม่สำเร็จ ลองใหม่')
    } finally {
      setCmdPending(false)
    }
  }

  async function handleToggleQueue() {
    await fetch(`/api/player?room=${roomCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_queue' }),
    }).catch(() => {})
  }

  async function handleRestart() {
    if (cmdPending) return
    setCmdPending(true)
    try {
      await playerCmd('restart')
    } catch {
      showCmdError('คำสั่งไม่สำเร็จ ลองใหม่')
    } finally {
      setCmdPending(false)
    }
  }

  async function handlePlayNow(id: number) {
    await fetch(`/api/queue/${id}?room=${roomCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'play_now' }),
    })
    fetchQueue()
  }

  async function handleRemove(id: number) {
    await fetch(`/api/queue/${id}?room=${roomCode}`, { method: 'DELETE' })
    fetchQueue()
  }

  async function handleClearQueue() {
    if (!confirm('ล้างคิวเพลงทั้งหมด? (เพลงที่กำลังเล่นจะยังคงอยู่)')) return
    setClearingQueue(true)
    try {
      await fetch(`/api/queue/clear?room=${roomCode}`, { method: 'DELETE' })
      fetchQueue()
    } finally {
      setClearingQueue(false)
    }
  }

  function handleAddUrl(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!url.trim() || addLoading) return
    if (urlIsPlaylist) {
      setShowUrlChoice(true)
      setAddError('')
      return
    }
    doAddUrl(url.trim())
  }

  async function doAddUrl(submitUrl: string) {
    setShowUrlChoice(false)
    setAddLoading(true)
    setAddError('')
    setAddSuccess('')
    try {
      const res = await fetch(`/api/queue?room=${roomCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtube_url: submitUrl, requested_by: requester.trim() || 'Guest' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddError(
          data.error === 'NO_API_KEY'
            ? 'ต้องตั้งค่า YOUTUBE_API_KEY เพื่อเพิ่มทั้ง Playlist'
            : (data.error ?? data.message ?? 'เกิดข้อผิดพลาด')
        )
      } else {
        setUrl('')
        setAddSuccess(data.batch ? `✅ เพิ่ม ${data.added} เพลงแล้ว` : '✅ เพิ่มเพลงแล้ว')
        setTimeout(() => setAddSuccess(''), 3000)
        setTab('queue')
        fetchQueue()
      }
    } catch {
      setAddError('ไม่สามารถเชื่อมต่อได้')
    } finally {
      setAddLoading(false)
    }
  }

  function handleChooseSingle() {
    const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
    if (!match) {
      setShowUrlChoice(false)
      setAddError('URL นี้ไม่มี Video ID (v=) — ลองเปิดเพลงนั้นใน YouTube แล้วคัดลอก URL ใหม่')
      return
    }
    doAddUrl(match[1])
  }

  const handleAddFromSearch = useCallback(async (videoId: string) => {
    const res = await fetch(`/api/queue?room=${roomCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtube_url: videoId, requested_by: requester.trim() || 'Guest' }),
    })
    if (!res.ok) throw new Error('Failed')
    fetchQueue()
  }, [roomCode, requester, fetchQueue])

  return (
    <div
      className="relative flex flex-col bg-gray-950 text-white overflow-hidden"
      style={{ height: '100dvh' }}
    >
      {/* Room Expired Overlay */}
      {roomExpired && (
        <div className="absolute inset-0 z-50 bg-gray-950/97 flex flex-col items-center justify-center gap-5 p-8">
          <span className="text-6xl">🎤</span>
          <p className="text-white text-xl font-semibold text-center">ห้องนี้ปิดแล้ว</p>
          <p className="text-gray-500 text-sm text-center leading-relaxed">
            ห้องคาราโอเกะนี้หมดอายุหรือถูกปิดไปแล้ว<br />กลับไปหน้าหลักเพื่อเข้าร่วมห้องใหม่
          </p>
          <a
            href="/"
            className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-2xl font-medium transition-colors"
          >
            กลับหน้าหลัก
          </a>
        </div>
      )}

      {/* Now Playing + Controls */}
      <div className="flex-shrink-0 bg-gray-900/95 border-b border-gray-800">
        <div
          className="flex items-center gap-3 px-4 pb-2"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
        >
          <div className="relative w-12 h-9 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800 ring-1 ring-white/5">
            {currentSong ? (
              <Image
                src={currentSong.thumbnail}
                alt={currentSong.title}
                fill
                sizes="48px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-700 text-xl">♪</div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {currentSong ? (
              <>
                <p className="text-white text-sm font-semibold truncate leading-snug">{currentSong.title}</p>
                <p className="text-gray-500 text-xs truncate">🎤 {currentSong.requested_by}</p>
              </>
            ) : (
              <p className="text-gray-600 text-sm">ไม่มีเพลงกำลังเล่น</p>
            )}
          </div>

          {/* Connection status dot */}
          <div
            title={connected ? 'เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อใหม่...'}
            className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
              connected ? 'bg-green-500' : 'bg-red-500 animate-pulse'
            }`}
          />

          <input
            type="text"
            value={requester}
            onChange={(e) => setRequester(e.target.value)}
            placeholder="ชื่อคุณ"
            className="w-20 bg-gray-800 border border-gray-700/80 rounded-xl px-2.5 py-1.5 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition"
          />
        </div>

        {/* Player Controls: Prev | Restart | Play/Pause | Next */}
        <div className="flex items-center justify-center gap-3 px-4 pb-3">
          <button
            onClick={handlePrev}
            disabled={!hasPrev || cmdPending}
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 disabled:opacity-20 disabled:pointer-events-none text-white text-lg transition-all active:scale-[0.93]"
            aria-label="เพลงก่อนหน้า"
          >⏮</button>
          <button
            onClick={handleRestart}
            disabled={!currentSong || cmdPending}
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 disabled:opacity-20 disabled:pointer-events-none text-white text-xl transition-all active:scale-[0.93]"
            aria-label="เริ่มเพลงใหม่"
          >↺</button>
          <button
            onClick={handlePlayPause}
            disabled={cmdPending}
            className="w-[64px] h-[64px] flex items-center justify-center rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-60 disabled:pointer-events-none text-white text-[26px] shadow-lg shadow-red-950/70 transition-all active:scale-[0.93]"
            aria-label={isPlaying ? 'หยุด' : 'เล่น'}
          >
            {cmdPending ? <span className="text-xl animate-spin">⏳</span> : isPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={handleNext}
            disabled={!hasNext || cmdPending}
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 disabled:opacity-20 disabled:pointer-events-none text-white text-lg transition-all active:scale-[0.93]"
            aria-label="เพลงถัดไป"
          >⏭</button>
        </div>

        <div className="flex items-center justify-center pb-3 -mt-1 gap-2">
          <button
            onClick={handleToggleQueue}
            className={`flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full border transition-colors ${
              queueVisible
                ? 'bg-red-600/20 border-red-600/50 text-red-400'
                : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'
            }`}
          >
            <span>📋</span>
            <span>{queueVisible ? 'ซ่อนคิวบนจอใหญ่' : 'แสดงคิวบนจอใหญ่'}</span>
          </button>
        </div>

        {cmdError && (
          <p className="text-center text-red-400 text-xs pb-2 -mt-1">{cmdError}</p>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">

        {tab === 'queue' && (
          <div className="h-full overflow-y-auto overscroll-contain">
            <div className="p-3 flex flex-col gap-2">

              <form onSubmit={handleAddUrl} className="flex gap-2 items-center">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    inputMode="url"
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setShowUrlChoice(false) }}
                    placeholder="วาง YouTube URL..."
                    className="w-full bg-gray-800/70 border border-gray-700/70 rounded-2xl px-3.5 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition pr-16"
                    disabled={addLoading}
                  />
                  {urlIsPlaylist && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-blue-700 text-white rounded px-1.5 py-0.5 pointer-events-none">
                      📋
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={addLoading || !url.trim()}
                  className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:bg-gray-800 disabled:text-gray-600 text-white text-xl font-light transition-all active:scale-[0.93]"
                  aria-label="เพิ่มเพลง"
                >
                  {addLoading ? <span className="text-sm animate-spin">⏳</span> : '＋'}
                </button>
              </form>

              {showUrlChoice && urlIsPlaylist && (
                <div className="bg-gray-800/90 border border-blue-700/50 rounded-2xl p-3 flex flex-col gap-2.5">
                  <p className="text-sm text-gray-200 font-medium px-0.5">📋 พบ Playlist — เพิ่มแบบไหน?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleChooseSingle}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-sm font-medium py-3 rounded-xl transition-colors active:scale-[0.97]"
                    >
                      🎵 เพลงนี้เพลงเดียว
                    </button>
                    <button
                      onClick={() => doAddUrl(url.trim())}
                      className="flex-1 bg-blue-700 hover:bg-blue-600 active:bg-blue-500 text-white text-sm font-medium py-3 rounded-xl transition-colors active:scale-[0.97]"
                    >
                      📋 ทั้ง Playlist
                    </button>
                  </div>
                  <button
                    onClick={() => setShowUrlChoice(false)}
                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors self-center py-0.5"
                  >
                    ยกเลิก
                  </button>
                </div>
              )}

              {addError   && <p className="text-red-400 text-xs px-1">{addError}</p>}
              {addSuccess && <p className="text-green-400 text-xs px-1">{addSuccess}</p>}

              {(queue.length > 0 || loading) && (
                <div className="flex items-center justify-between px-1 mt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-600">
                    คิว{queueCount > 0 ? ` · ${queueCount} เพลง` : ''}
                  </span>
                  {queue.some((q) => q.status === 'queued' || q.status === 'done') && (
                    <button
                      onClick={handleClearQueue}
                      disabled={clearingQueue}
                      className="text-xs text-gray-600 hover:text-red-400 active:text-red-300 transition-colors disabled:opacity-40 rounded-lg py-1 px-2 -mr-1"
                    >
                      {clearingQueue ? 'ล้างอยู่...' : '🗑 ล้างคิว'}
                    </button>
                  )}
                </div>
              )}

              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-700 gap-3">
                  <span className="text-3xl animate-spin">⏳</span>
                  <span className="text-sm">กำลังโหลด...</span>
                </div>
              ) : queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-700 gap-3">
                  <span className="text-5xl opacity-30">🎵</span>
                  <p className="text-sm text-gray-600">คิวว่างอยู่ — เพิ่มเพลงเลย!</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-1.5 pb-2">
                  {queue.map((item, index) => {
                    const isNowPlaying = item.status === 'playing'
                    const isDone       = item.status === 'done'
                    return (
                      <li
                        key={item.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all ${
                          isNowPlaying
                            ? 'bg-red-950/40 border-red-800/50'
                            : isDone
                            ? 'bg-gray-900/20 border-gray-800/30 opacity-45'
                            : 'bg-gray-800/40 border-gray-700/30'
                        }`}
                      >
                        <div className="w-5 text-center flex-shrink-0 flex items-center justify-center">
                          {isNowPlaying ? (
                            <span className="block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          ) : (
                            <span className="text-[11px] text-gray-600">{index + 1}</span>
                          )}
                        </div>
                        <div className="relative w-12 h-9 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
                          <Image src={item.thumbnail} alt={item.title} fill sizes="48px" className="object-cover" unoptimized />
                        </div>
                        <div className="flex-1 min-w-0">
                          {isNowPlaying ? (
                            <div className="marquee-container leading-snug">
                              <div className="marquee-track">
                                <span className="text-sm font-medium text-white">{item.title}</span>
                                <span className="text-sm font-medium text-white">{item.title}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm font-medium text-gray-200 truncate leading-snug">{item.title}</p>
                          )}
                          <p className="text-xs text-gray-600 truncate mt-0.5">🎤 {item.requested_by}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {!isNowPlaying && !isDone && (
                            <button
                              onClick={() => handlePlayNow(item.id)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-900/30 hover:bg-green-800/50 active:bg-green-800 text-green-500 text-sm transition-all active:scale-[0.93]"
                              title="เล่นเดี๋ยวนี้"
                            >▶</button>
                          )}
                          <button
                            onClick={() => setSaveTarget(item)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-700/30 hover:bg-blue-900/40 active:bg-blue-900 text-gray-500 hover:text-blue-400 text-sm transition-all active:scale-[0.93]"
                            title="บันทึกในเพลย์ลิสต์"
                          >💾</button>
                          {!isNowPlaying && (
                            <button
                              onClick={() => handleRemove(item.id)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-700/30 hover:bg-red-900/40 active:bg-red-900 text-gray-500 hover:text-red-400 text-sm transition-all active:scale-[0.93]"
                              title="ลบออกจากคิว"
                            >✕</button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === 'search' && (
          <div className="h-full overflow-y-auto overscroll-contain p-3">
            <SearchPanel onAddSong={handleAddFromSearch} />
          </div>
        )}

        {tab === 'playlist' && (
          <div className="h-full overflow-hidden flex flex-col">
            <PlaylistPanel roomCode={roomCode} onLoadToQueue={fetchQueue} />
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav
        className="flex-shrink-0 flex bg-gray-900/95 border-t border-gray-800"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {NAV_TABS.map((t) => {
          const badge  = t.id === 'queue' ? queueCount : 0
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 relative flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors ${
                active ? 'text-white' : 'text-gray-600 active:text-gray-400'
              }`}
            >
              {active && (
                <span className="absolute top-0 left-[30%] right-[30%] h-[2px] bg-red-500 rounded-full" />
              )}
              <span className={`text-[18px] leading-none transition-transform ${active ? 'scale-110' : 'scale-100'}`}>
                {t.icon}
              </span>
              <span className="text-[10px] font-medium tracking-wide leading-none relative">
                {t.label}
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-3.5 min-w-[16px] h-4 flex items-center justify-center bg-red-600 text-white text-[9px] font-bold rounded-full px-0.5 leading-none">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </nav>

      {saveTarget && (
        <SaveToPlaylistModal roomCode={roomCode} song={saveTarget} onClose={() => setSaveTarget(null)} />
      )}
    </div>
  )
}
