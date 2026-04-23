'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useRemote } from '@/hooks/useQueue'
import SearchPanel from '@/components/SearchPanel'
import PlaylistPanel from '@/components/PlaylistPanel'
import SaveToPlaylistModal from '@/components/SaveToPlaylistModal'
import type { QueueItem } from '@/types'

type Tab = 'queue' | 'search' | 'playlist' | 'display'

interface Toast {
  id: number
  msg: string
  type: 'success' | 'error' | 'info'
}

let toastSeq = 0

function vibrate(ms: number | number[] = 10) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms)
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function RoomRemotePage() {
  const params = useParams<{ roomCode: string }>()
  const roomCode = (params.roomCode ?? '').toUpperCase()

  const { queue, loading, fetchQueue, queueHash, isPlaying, connected, roomExpired, queueVisible, setQueueVisible } =
    useRemote(roomCode)

  const [cmdPending, setCmdPending] = useState(false)
  const [tab, setTab] = useState<Tab>('queue')
  const [requester, setRequester] = useState('')
  const [url, setUrl] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [saveTarget, setSaveTarget] = useState<QueueItem | null>(null)
  const [clearingQueue, setClearingQueue] = useState(false)
  const [showUrlChoice, setShowUrlChoice] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  // Persist name across sessions
  useEffect(() => {
    const saved = localStorage.getItem('karaoke_name')
    if (saved) setRequester(saved)
  }, [])
  useEffect(() => {
    if (requester) localStorage.setItem('karaoke_name', requester)
  }, [requester])

  const urlIsPlaylist = /[?&]list=[a-zA-Z0-9_-]+/.test(url)
  const currentSong = queue.find((q) => q.status === 'playing') ?? null
  const nextSong = queue.find((q) => q.status === 'queued') ?? null
  const hasNext = queue.some((q) => q.status === 'queued')
  const hasPrev = queue.some((q) => q.status === 'done')
  const queueCount = queue.filter((q) => q.status !== 'done').length

  function toast(msg: string, type: Toast['type'] = 'info') {
    const id = ++toastSeq
    setToasts((prev) => [...prev, { id, msg, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }

  async function playerCmd(action: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (queueHash && (action === 'next' || action === 'prev')) headers['x-queue-hash'] = queueHash

    const res = await fetch(`/api/player?room=${roomCode}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action }),
    })
    if (res.status === 409) {
      await fetchQueue()
      throw new Error('conflict')
    }
    if (!res.ok) throw new Error('failed')
  }

  async function execCmd(action: string, after?: () => void) {
    if (cmdPending) return
    vibrate(8)
    setCmdPending(true)
    try {
      await playerCmd(action)
      after?.()
    } catch {
      toast('คำสั่งไม่สำเร็จ ลองใหม่', 'error')
      vibrate([10, 50, 10])
    } finally {
      setCmdPending(false)
    }
  }

  async function handleToggleQueue() {
    vibrate(8)
    try {
      const res = await fetch(`/api/player?room=${roomCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_queue' }),
      })
      const data = await res.json()
      if (res.ok && typeof data.queue_visible === 'boolean') {
        setQueueVisible(data.queue_visible)
      }
    } catch {}
  }

  async function handlePlayNow(id: number) {
    vibrate(8)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (queueHash) headers['x-queue-hash'] = queueHash

    const res = await fetch(`/api/queue/${id}?room=${roomCode}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ action: 'play_now' }),
    })
    if (res.status === 409) {
      await fetchQueue()
      toast('คิวเปลี่ยนจากเครื่องอื่น กำลังรีเฟรช', 'info')
      return
    }
    fetchQueue()
    toast('เล่นเพลงนี้แล้ว', 'success')
  }

  async function handleRemove(id: number) {
    vibrate(8)
    const headers: Record<string, string> = {}
    if (queueHash) headers['x-queue-hash'] = queueHash

    const res = await fetch(`/api/queue/${id}?room=${roomCode}`, { method: 'DELETE', headers })
    if (res.status === 409) {
      await fetchQueue()
      toast('คิวเปลี่ยนจากเครื่องอื่น กำลังรีเฟรช', 'info')
      return
    }
    fetchQueue()
  }

  async function handleReorder(id: number, direction: 'up' | 'down') {
    const queuedIds = queue.filter((q) => q.status === 'queued').map((q) => q.id)
    const idx = queuedIds.indexOf(id)
    if (idx < 0) return

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= queuedIds.length) return

    const orderedIds = [...queuedIds]
    ;[orderedIds[idx], orderedIds[targetIdx]] = [orderedIds[targetIdx], orderedIds[idx]]

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (queueHash) headers['x-queue-hash'] = queueHash

    vibrate(8)
    try {
      const res = await fetch(`/api/queue/reorder?room=${roomCode}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ordered_ids: orderedIds }),
      })

      if (res.status === 409) {
        await fetchQueue()
        toast('คิวเปลี่ยนจากเครื่องอื่น กำลังรีเฟรช', 'info')
        return
      }
      if (!res.ok) throw new Error('failed')

      fetchQueue()
    } catch {
      toast('จัดลำดับคิวไม่สำเร็จ ลองใหม่', 'error')
    }
  }

  async function handleClearQueue() {
    if (!confirm('ล้างคิวเพลงทั้งหมด?\n(เพลงที่กำลังเล่นจะยังคงอยู่)')) return
    setClearingQueue(true)
    try {
      const headers: Record<string, string> = {}
      if (queueHash) headers['x-queue-hash'] = queueHash

      const res = await fetch(`/api/queue/clear?room=${roomCode}`, { method: 'DELETE', headers })
      if (res.status === 409) {
        await fetchQueue()
        toast('คิวเปลี่ยนจากเครื่องอื่น กำลังรีเฟรช', 'info')
        return
      }
      fetchQueue()
      toast('ล้างคิวแล้ว', 'success')
    } finally {
      setClearingQueue(false)
    }
  }

  function handleAddUrl(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!url.trim() || addLoading) return
    if (urlIsPlaylist) {
      setShowUrlChoice(true)
      return
    }
    doAddUrl(url.trim())
  }

  async function doAddUrl(submitUrl: string) {
    setShowUrlChoice(false)
    setAddLoading(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (queueHash) headers['x-queue-hash'] = queueHash

      const res = await fetch(`/api/queue?room=${roomCode}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          youtube_url: submitUrl,
          requested_by: requester.trim() || 'Guest',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(
          data.error === 'NO_API_KEY'
            ? 'ต้องตั้งค่า YOUTUBE_API_KEY เพื่อเพิ่มทั้ง Playlist'
            : (data.error ?? data.message ?? 'เกิดข้อผิดพลาด'),
          'error'
        )
      } else {
        setUrl('')
        toast(data.batch ? `เพิ่ม ${data.added} เพลงแล้ว` : 'เพิ่มเพลงแล้ว', 'success')
        vibrate([8, 40, 8])
        setTab('queue')
        fetchQueue()
      }
    } catch {
      toast('ไม่สามารถเชื่อมต่อได้', 'error')
    } finally {
      setAddLoading(false)
    }
  }

  function handleChooseSingle() {
    const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
    if (!match) {
      setShowUrlChoice(false)
      toast('URL นี้ไม่มี Video ID — ลองคัดลอก URL ใหม่', 'error')
      return
    }
    doAddUrl(match[1])
  }

  const handleAddFromSearch = useCallback(
    async (videoId: string) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (queueHash) headers['x-queue-hash'] = queueHash

      const res = await fetch(`/api/queue?room=${roomCode}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ youtube_url: videoId, requested_by: requester.trim() || 'Guest' }),
      })
      if (!res.ok) throw new Error('Failed')
      fetchQueue()
    },
    [roomCode, requester, fetchQueue, queueHash]
  )

  return (
    <div
      className="relative flex flex-col bg-gray-950 text-white overflow-hidden"
      style={{ height: '100dvh' }}
    >
      {/* Toast stack — sits above bottom nav */}
      <div
        className="absolute left-4 right-4 z-40 flex flex-col-reverse gap-2 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 68px)' }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`text-center px-4 py-2.5 rounded-2xl text-sm font-medium shadow-xl shadow-black/50 ${
              t.type === 'success'
                ? 'bg-green-600 text-white'
                : t.type === 'error'
                ? 'bg-red-700 text-white'
                : 'bg-gray-700 text-white'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>

      {/* Room expired overlay */}
      {roomExpired && (
        <div className="absolute inset-0 z-50 bg-gray-950/98 flex flex-col items-center justify-center gap-5 p-8">
          <span className="text-6xl">🎤</span>
          <p className="text-white text-xl font-semibold">ห้องนี้ปิดแล้ว</p>
          <p className="text-gray-500 text-sm text-center leading-relaxed">
            ห้องคาราโอเกะนี้หมดอายุหรือถูกปิดไปแล้ว
            <br />
            กลับไปหน้าหลักเพื่อเข้าร่วมห้องใหม่
          </p>
          <Link
            href="/"
            className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white px-8 py-3 rounded-2xl font-medium transition-colors"
          >
            กลับหน้าหลัก
          </Link>
        </div>
      )}

      {/* ── Header: Now Playing + Controls ── */}
      <div className="flex-shrink-0 relative" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {/* Blurred hero background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {currentSong ? (
            <>
              <Image
                src={currentSong.thumbnail}
                alt=""
                fill
                sizes="100vw"
                className="object-cover scale-125 blur-3xl opacity-[0.12]"
                unoptimized
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 via-gray-900/90 to-gray-950" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gray-900" />
          )}
        </div>

        <div className="relative px-4 pt-3 pb-1">
          {/* Top row: room label · name input · connection dot */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold tracking-[0.18em] text-gray-600 uppercase">
              ห้อง {roomCode}
            </span>
            <div className="flex-1" />
            <input
              type="text"
              value={requester}
              onChange={(e) => setRequester(e.target.value)}
              placeholder="ชื่อของคุณ"
              className="w-[100px] bg-gray-800/70 border border-gray-700/50 rounded-xl px-3 py-1.5 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all"
            />
            <span
              title={connected ? 'เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อ...'}
              className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                connected ? 'bg-green-500' : 'bg-amber-500 animate-pulse'
              }`}
            />
          </div>

          {/* Song info row */}
          <div className="flex items-center gap-3 mb-4">
            {/* Thumbnail */}
            <div className="relative w-14 h-10 flex-shrink-0 rounded-xl overflow-hidden bg-gray-800 ring-1 ring-white/8 shadow-lg shadow-black/40">
              {currentSong ? (
                <Image
                  src={currentSong.thumbnail}
                  alt={currentSong.title}
                  fill
                  sizes="56px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-700 text-xl">♪</div>
              )}
              {isPlaying && currentSong && (
                <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              )}
            </div>

            {/* Title + requester */}
            <div className="flex-1 min-w-0">
              {currentSong ? (
                <>
                  <p className="text-white text-sm font-semibold truncate leading-snug">{currentSong.title}</p>
                  <p className="text-gray-500 text-xs truncate mt-0.5">🎤 {currentSong.requested_by}</p>
                </>
              ) : (
                <>
                  <p className="text-gray-600 text-sm font-medium">ไม่มีเพลงกำลังเล่น</p>
                  <p className="text-gray-700 text-xs mt-0.5">เพิ่มเพลงในคิวด้านล่าง</p>
                </>
              )}
            </div>

            {/* Next up preview */}
            {nextSong && (
              <div className="flex-shrink-0 text-right max-w-[88px]">
                <p className="text-[10px] text-gray-700 font-medium leading-none mb-0.5">ถัดไป</p>
                <p className="text-[11px] text-gray-500 truncate leading-snug">{nextSong.title}</p>
              </div>
            )}
          </div>

          {/* Playback controls */}
          <div className="flex items-center justify-center gap-3 pb-3">
            <CtrlBtn
              onClick={() => execCmd('prev', fetchQueue)}
              disabled={!hasPrev || cmdPending}
              label="เพลงก่อนหน้า"
            >⏮</CtrlBtn>

            <CtrlBtn
              onClick={() => execCmd('restart')}
              disabled={!currentSong || cmdPending}
              label="เริ่มใหม่"
            >↺</CtrlBtn>

            {/* Play / Pause — prominent centre button */}
            <button
              onClick={() => execCmd(isPlaying ? 'pause' : 'play')}
              disabled={cmdPending}
              aria-label={isPlaying ? 'หยุด' : 'เล่น'}
              className="w-[68px] h-[68px] flex items-center justify-center rounded-[22px] bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-60 disabled:pointer-events-none text-white text-[26px] shadow-xl shadow-red-950/60 border border-red-500/25 transition-all active:scale-[0.92]"
            >
              {cmdPending
                ? <span className="text-xl animate-spin inline-block">⏳</span>
                : isPlaying
                ? '⏸'
                : <span className="ml-0.5">▶</span>}
            </button>

            <CtrlBtn
              onClick={() => execCmd('next', fetchQueue)}
              disabled={!hasNext || cmdPending}
              label="เพลงถัดไป"
            >⏭</CtrlBtn>

            <CtrlBtn
              onClick={handleToggleQueue}
              active={queueVisible}
              label={queueVisible ? 'ซ่อนคิวบนจอใหญ่' : 'แสดงคิวบนจอใหญ่'}
            >📋</CtrlBtn>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="flex-shrink-0 h-px bg-gray-800/50 mx-4" />

      {/* ── Tab Content ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'queue' && (
          <QueueTab
            queue={queue}
            loading={loading}
            queueCount={queueCount}
            url={url}
            setUrl={(v) => { setUrl(v); setShowUrlChoice(false) }}
            addLoading={addLoading}
            urlIsPlaylist={urlIsPlaylist}
            showUrlChoice={showUrlChoice}
            setShowUrlChoice={setShowUrlChoice}
            clearingQueue={clearingQueue}
            onSubmit={handleAddUrl}
            onChooseSingle={handleChooseSingle}
            onChoosePlaylist={() => doAddUrl(url.trim())}
            onPlayNow={handlePlayNow}
            onRemove={handleRemove}
            onMoveUp={(id) => handleReorder(id, 'up')}
            onMoveDown={(id) => handleReorder(id, 'down')}
            onSave={setSaveTarget}
            onClear={handleClearQueue}
          />
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

        {tab === 'display' && (
          <DisplayTab queueVisible={queueVisible} onToggleQueue={handleToggleQueue} roomCode={roomCode} />
        )}
      </div>

      {/* ── Bottom Navigation ── */}
      <nav
        className="flex-shrink-0 flex bg-gray-900/95 border-t border-gray-800/70 backdrop-blur-sm"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {(
          [
            { id: 'queue',    icon: '♫',  label: 'คิว',     badge: queueCount },
            { id: 'search',   icon: '◎',  label: 'ค้นหา',   badge: 0 },
            { id: 'playlist', icon: '≡',  label: 'Playlist', badge: 0 },
            { id: 'display',  icon: '📺', label: 'จอใหญ่',  badge: 0 },
          ] as { id: Tab; icon: string; label: string; badge: number }[]
        ).map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => { vibrate(6); setTab(t.id) }}
              className={`flex-1 relative flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-colors ${
                active ? 'text-white' : 'text-gray-600 active:text-gray-300'
              }`}
            >
              {active && (
                <span className="absolute top-0 left-[22%] right-[22%] h-[2px] bg-red-500 rounded-full" />
              )}
              <span className={`text-[18px] leading-none transition-transform ${active ? 'scale-110' : 'scale-100'}`}>
                {t.icon}
              </span>
              <span className="text-[10px] font-medium tracking-wide leading-none mt-0.5 relative">
                {t.label}
                {t.badge > 0 && (
                  <span className="absolute -top-1.5 -right-3.5 min-w-[16px] h-[15px] flex items-center justify-center bg-red-600 text-[9px] font-bold rounded-full px-0.5">
                    {t.badge > 9 ? '9+' : t.badge}
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

// ─── Small reusable control button ──────────────────────────────────────────

function CtrlBtn({
  children,
  onClick,
  disabled,
  active,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
  label: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`w-12 h-12 flex items-center justify-center rounded-2xl text-lg border transition-all active:scale-[0.92] disabled:opacity-20 disabled:pointer-events-none ${
        active
          ? 'bg-red-600/20 border-red-600/40 text-red-400 hover:bg-red-600/30'
          : 'bg-gray-800/60 border-white/5 text-white hover:bg-gray-700/70 active:bg-gray-600'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Queue Tab ───────────────────────────────────────────────────────────────

function QueueTab({
  queue,
  loading,
  queueCount,
  url,
  setUrl,
  addLoading,
  urlIsPlaylist,
  showUrlChoice,
  setShowUrlChoice,
  clearingQueue,
  onSubmit,
  onChooseSingle,
  onChoosePlaylist,
  onPlayNow,
  onRemove,
  onMoveUp,
  onMoveDown,
  onSave,
  onClear,
}: {
  queue: QueueItem[]
  loading: boolean
  queueCount: number
  url: string
  setUrl: (v: string) => void
  addLoading: boolean
  urlIsPlaylist: boolean
  showUrlChoice: boolean
  setShowUrlChoice: (v: boolean) => void
  clearingQueue: boolean
  onSubmit: (e: { preventDefault(): void }) => void
  onChooseSingle: () => void
  onChoosePlaylist: () => void
  onPlayNow: (id: number) => void
  onRemove: (id: number) => void
  onMoveUp: (id: number) => void
  onMoveDown: (id: number) => void
  onSave: (item: QueueItem) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const queuedIds = queue.filter((q) => q.status === 'queued').map((q) => q.id)

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="p-3 flex flex-col gap-2.5">

        {/* Add URL form */}
        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <input
              ref={inputRef}
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="วาง YouTube URL หรือ Video ID..."
              className="w-full bg-gray-800/55 border border-gray-700/50 rounded-2xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all pr-[72px]"
              disabled={addLoading}
            />
            {urlIsPlaylist && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-blue-600 text-white rounded-lg px-2 py-[3px] font-semibold pointer-events-none">
                Playlist
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={addLoading || !url.trim()}
            className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:bg-gray-800 disabled:text-gray-600 text-white text-2xl shadow-lg shadow-red-950/40 transition-all active:scale-[0.92]"
            aria-label="เพิ่มเพลง"
          >
            {addLoading ? <span className="text-base animate-spin">⏳</span> : '+'}
          </button>
        </form>

        {/* Playlist choice card */}
        {showUrlChoice && (
          <div className="bg-gray-800/80 border border-blue-700/40 rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-sm text-gray-100 font-semibold">พบ Playlist — เพิ่มแบบไหน?</p>
            <div className="flex gap-2">
              <button
                onClick={onChooseSingle}
                className="flex-1 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-sm font-medium py-3 rounded-xl transition-all active:scale-[0.97]"
              >
                🎵 เพลงเดียว
              </button>
              <button
                onClick={onChoosePlaylist}
                className="flex-1 bg-blue-700 hover:bg-blue-600 active:bg-blue-800 text-white text-sm font-medium py-3 rounded-xl transition-all active:scale-[0.97]"
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

        {/* Queue header */}
        {queue.length > 0 && (
          <div className="flex items-center justify-between px-1 mt-0.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-600">
              คิว{queueCount > 0 ? ` · ${queueCount} เพลง` : ''}
            </span>
            {queue.some((q) => q.status === 'queued' || q.status === 'done') && (
              <button
                onClick={onClear}
                disabled={clearingQueue}
                className="text-xs text-gray-600 hover:text-red-400 active:text-red-300 transition-colors disabled:opacity-40 py-1 px-2 -mr-1 rounded-lg"
              >
                {clearingQueue ? 'กำลังล้าง...' : '🗑 ล้างคิว'}
              </button>
            )}
          </div>
        )}

        {/* Queue items */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-3xl animate-spin">⏳</span>
            <span className="text-sm text-gray-600">กำลังโหลด...</span>
          </div>
        ) : queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl opacity-20">🎵</span>
            <p className="text-sm text-gray-600 text-center leading-relaxed">
              คิวว่างอยู่<br />วาง URL หรือค้นหาเพลงด้านบน
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5 pb-4">
            {queue.map((item, index) => {
              const isNowPlaying = item.status === 'playing'
              const isDone       = item.status === 'done'
              const queuedIndex = queuedIds.indexOf(item.id)
              const canMoveUp = queuedIndex > 0
              const canMoveDown = queuedIndex >= 0 && queuedIndex < queuedIds.length - 1
              return (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all ${
                    isNowPlaying
                      ? 'bg-red-950/30 border-red-800/40 shadow-sm shadow-red-950/20'
                      : isDone
                      ? 'opacity-30 border-transparent'
                      : 'bg-gray-800/30 border-gray-700/20'
                  }`}
                >
                  {/* Position indicator */}
                  <div className="w-5 flex-shrink-0 flex items-center justify-center">
                    {isNowPlaying ? (
                      <span className="block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    ) : (
                      <span className="text-[11px] text-gray-600 font-medium">{index + 1}</span>
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className="relative w-14 h-10 flex-shrink-0 rounded-xl overflow-hidden bg-gray-800">
                    <Image
                      src={item.thumbnail}
                      alt={item.title}
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>

                  {/* Info */}
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

                  {/* Actions */}
                  <div className="flex gap-1 flex-shrink-0">
                    {!isNowPlaying && !isDone && (
                      <>
                        <button
                          onClick={() => onMoveUp(item.id)}
                          disabled={!canMoveUp}
                          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-700/20 hover:bg-gray-600/40 disabled:opacity-35 disabled:pointer-events-none text-gray-300 text-sm transition-all active:scale-[0.92]"
                          title="เลื่อนขึ้น"
                        >↑</button>
                        <button
                          onClick={() => onMoveDown(item.id)}
                          disabled={!canMoveDown}
                          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-700/20 hover:bg-gray-600/40 disabled:opacity-35 disabled:pointer-events-none text-gray-300 text-sm transition-all active:scale-[0.92]"
                          title="เลื่อนลง"
                        >↓</button>
                      </>
                    )}
                    {!isNowPlaying && !isDone && (
                      <button
                        onClick={() => onPlayNow(item.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-900/30 hover:bg-green-800/50 active:bg-green-800 text-green-500 text-sm transition-all active:scale-[0.92]"
                        title="เล่นเดี๋ยวนี้"
                      >▶</button>
                    )}
                    <button
                      onClick={() => onSave(item)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-700/20 hover:bg-blue-900/40 text-gray-500 hover:text-blue-400 text-sm transition-all active:scale-[0.92]"
                      title="บันทึกใน Playlist"
                    >💾</button>
                    {!isNowPlaying && (
                      <button
                        onClick={() => onRemove(item.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-700/20 hover:bg-red-900/40 text-gray-500 hover:text-red-400 text-sm transition-all active:scale-[0.92]"
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
  )
}

// ─── Display Tab ─────────────────────────────────────────────────────────────

function DisplayTab({
  queueVisible,
  onToggleQueue,
  roomCode,
}: {
  queueVisible: boolean
  onToggleQueue: () => void
  roomCode: string
}) {
  return (
    <div className="h-full overflow-y-auto overscroll-contain p-4">
      <div className="flex flex-col gap-4 pt-3">

        {/* Section title */}
        <div>
          <p className="text-gray-300 text-base font-semibold">ควบคุมจอใหญ่</p>
          <p className="text-gray-600 text-xs mt-0.5">การตั้งค่าจะมีผลทันทีบนหน้าจอ Display</p>
        </div>

        {/* Queue visibility */}
        <div className="bg-gray-800/40 border border-gray-700/30 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium">แสดงคิวบนจอใหญ่</p>
            <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">
              {queueVisible
                ? 'คิวกำลังแสดงอยู่ทางขวาของจอ'
                : 'คิวถูกซ่อนอยู่ — กดเพื่อแสดง'}
            </p>
          </div>
          <Toggle checked={queueVisible} onChange={onToggleQueue} />
        </div>

        {/* Playback section header */}
        <p className="text-gray-600 text-xs font-bold uppercase tracking-[0.14em] px-0.5">
          การเล่น
        </p>

        {/* Playback info card */}
        <div className="bg-gray-800/30 border border-gray-700/20 rounded-2xl p-4 flex flex-col gap-3">
          <Row label="เล่น / หยุด" note="ใช้ปุ่ม ▶ ด้านบน" />
          <Row label="เพลงถัดไป" note="ใช้ปุ่ม ⏭ ด้านบน" />
          <Row label="เพลงก่อนหน้า" note="ใช้ปุ่ม ⏮ ด้านบน" />
          <Row label="เริ่มเพลงใหม่" note="ใช้ปุ่ม ↺ ด้านบน" />
        </div>

        {/* Link hint */}
        <div className="bg-gray-800/20 border border-gray-700/15 rounded-2xl p-4">
          <p className="text-gray-600 text-xs leading-relaxed">
            เปิดหน้าจอ Display บน TV หรือโปรเจกเตอร์:
          </p>
          <p className="text-gray-400 text-xs font-mono mt-1 break-all">
            /{roomCode}/display
          </p>
        </div>

      </div>
    </div>
  )
}

function Row({ label, note }: { label: string; note: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-gray-300">{label}</span>
      <span className="text-xs text-gray-600">{note}</span>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      aria-label={checked ? 'ปิด' : 'เปิด'}
      className={`relative flex-shrink-0 w-14 h-8 rounded-full border transition-colors duration-200 ${
        checked ? 'bg-red-600 border-red-500/40' : 'bg-gray-700 border-gray-600/40'
      }`}
    >
      <span
        className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${
          checked ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
