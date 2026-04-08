'use client'

import { useEffect, useRef, useCallback } from 'react'

declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
  }
}

interface Props {
  videoId: string | null
  onReady: (player: YT.Player) => void
  onStateChange: (state: number) => void
}

export default function YoutubePlayer({ videoId, onReady, onStateChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const isAPIReady = useRef(false)

  const initPlayer = useCallback(() => {
    if (!containerRef.current || playerRef.current) return

    playerRef.current = new window.YT.Player(containerRef.current, {
      width: '100%',
      height: '100%',
      videoId: videoId ?? '',
      playerVars: {
        autoplay: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
      },
      events: {
        onReady: (e) => onReady(e.target),
        onStateChange: (e) => onStateChange(e.data),
      },
    })
  }, [videoId, onReady, onStateChange])

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      isAPIReady.current = true
      initPlayer()
      return
    }

    const existing = document.getElementById('yt-iframe-api')
    if (!existing) {
      const tag = document.createElement('script')
      tag.id = 'yt-iframe-api'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }

    window.onYouTubeIframeAPIReady = () => {
      isAPIReady.current = true
      initPlayer()
    }
  }, [initPlayer])

  // Load new video when videoId changes
  useEffect(() => {
    if (playerRef.current && videoId && isAPIReady.current) {
      playerRef.current.loadVideoById(videoId)
    }
  }, [videoId])

  return (
    <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
      <div
        ref={containerRef}
        className="absolute inset-0 rounded-xl overflow-hidden bg-black"
      />
      {!videoId && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 rounded-xl gap-3">
          <span className="text-6xl">🎤</span>
          <p className="text-gray-400 text-lg font-medium">YouTube Karaoke</p>
          <p className="text-gray-600 text-sm">เพิ่มเพลงในคิวเพื่อเริ่มเล่น</p>
        </div>
      )}
    </div>
  )
}
