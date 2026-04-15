'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { QueueItem } from '@/types'
import { usePlayerSSE } from '@/hooks/useQueue'

const YoutubePlayer = dynamic(() => import('@/components/YoutubePlayer'), { ssr: false })

export default function RoomDisplayPage() {
  const params = useParams<{ roomCode: string }>()
  const roomCode = (params.roomCode ?? '').toUpperCase()

  const [queue, setQueue] = useState<QueueItem[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [serverIp, setServerIp] = useState('')
  const playerRef = useRef<YT.Player | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const queueRef = useRef(queue)
  const isAdvancingRef = useRef(false)
  useEffect(() => { queueRef.current = queue }, [queue])

  const currentSong = queue.find((q) => q.status === 'playing') ?? null

  const fetchQueue = useCallback(async () => {
    const res = await fetch(`/api/queue?room=${roomCode}`)
    const data = await res.json()
    setQueue(data)
  }, [roomCode])

  useEffect(() => {
    if (!roomCode) return
    fetchQueue()
    setServerIp(window.location.host)
  }, [roomCode, fetchQueue])

  const handleNext = useCallback(async () => {
    if (isAdvancingRef.current) return
    const playing = queueRef.current.find((q) => q.status === 'playing')
    if (!playing) return
    isAdvancingRef.current = true
    try {
      const res = await fetch(`/api/queue/${playing.id}?room=${roomCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'next' }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.done) setIsPlaying(false)
      }
      await fetchQueue()
    } finally {
      isAdvancingRef.current = false
    }
  }, [roomCode, fetchQueue])

  usePlayerSSE(
    roomCode,
    fetchQueue,
    useCallback((cmd) => {
      if (!playerRef.current) return
      if (cmd === 'play') playerRef.current.playVideo()
      if (cmd === 'pause') playerRef.current.pauseVideo()
      if (cmd === 'restart') { playerRef.current.seekTo(0, true); playerRef.current.playVideo() }
    }, [])
  )

  const handleStateChange = useCallback(
    (state: number) => {
      if (state === 1) setIsPlaying(true)
      if (state === 2) setIsPlaying(false)
      if (state === 0) handleNext()
    },
    [handleNext]
  )

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else containerRef.current?.requestFullscreen()
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-black flex flex-col relative overflow-hidden"
    >
      <div className="flex-1 relative">
        <YoutubePlayer
          videoId={currentSong?.youtube_video_id ?? null}
          onReady={(p) => { playerRef.current = p }}
          onStateChange={handleStateChange}
        />
      </div>

      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-4">
          <span className="text-white text-lg font-bold flex-shrink-0">🎤</span>
          {currentSong ? (
            <span className="text-white font-bold text-lg truncate leading-tight">
              {currentSong.title}
            </span>
          ) : (
            <span className="text-white font-semibold text-sm">YouTube Karaoke</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {serverIp && (
            <div className="text-right">
              <p className="text-gray-400 text-xs">รีโมทมือถือ</p>
              <p className="text-white font-mono text-sm font-bold">
                {serverIp}/{roomCode}/remote
              </p>
            </div>
          )}
          <button
            onClick={toggleFullscreen}
            className="bg-white/10 hover:bg-white/20 text-white rounded-lg px-3 py-1.5 text-sm transition-colors"
          >
            ⛶ เต็มจอ
          </button>
        </div>
      </div>

      {!currentSong && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black">
          <span className="text-8xl">🎤</span>
          <p className="text-white text-3xl font-bold">YouTube Karaoke</p>
          <p className="text-gray-500 text-lg">เพิ่มเพลงผ่านรีโมทมือถือ</p>
          {serverIp && (
            <div className="mt-4 bg-gray-900 border border-gray-700 rounded-2xl px-8 py-5 text-center">
              <p className="text-gray-400 text-sm mb-1">เปิดในมือถือหรือแท็บเล็ต</p>
              <p className="text-white font-mono text-2xl font-bold tracking-wider">
                {serverIp}/{roomCode}/remote
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
