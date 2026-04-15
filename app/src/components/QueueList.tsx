'use client'

import Image from 'next/image'
import type { QueueItem } from '@/types'

interface Props {
  queue: QueueItem[]
  currentId: number | null
  onPlayNow: (id: number) => void
  onRemove: (id: number) => void
  onSaveToPlaylist: (item: QueueItem) => void
}

export default function QueueList({ queue, currentId, onPlayNow, onRemove, onSaveToPlaylist }: Props) {
  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-500 gap-2">
        <span className="text-4xl">🎵</span>
        <p className="text-sm">คิวว่างอยู่ เพิ่มเพลงเลย!</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-320px)]">
      {queue.map((item, index) => {
        const isPlaying = item.status === 'playing'
        return (
          <li
            key={item.id}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
              isPlaying
                ? 'bg-red-900/40 border-red-500 shadow-lg shadow-red-900/30'
                : 'bg-gray-800/60 border-gray-700 hover:border-gray-500'
            }`}
          >
            {/* Index / playing indicator */}
            <div className="w-7 text-center flex-shrink-0">
              {isPlaying ? (
                <span className="text-red-400 text-lg animate-pulse">▶</span>
              ) : (
                <span className="text-gray-500 text-sm">{index + 1}</span>
              )}
            </div>

            {/* Thumbnail */}
            <div className="relative w-16 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-700">
              <Image
                src={item.thumbnail}
                alt={item.title}
                fill
                sizes="64px"
                className="object-cover"
                unoptimized
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isPlaying ? 'text-white' : 'text-gray-200'}`}>
                {item.title}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {item.requested_by !== 'Guest' ? `🎤 ${item.requested_by}` : '🎤 Guest'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-1 flex-shrink-0">
              {!isPlaying && (
                <button
                  onClick={() => onPlayNow(item.id)}
                  title="เล่นเพลงนี้เลย"
                  className="p-1.5 rounded-lg bg-green-700/50 hover:bg-green-600 text-green-300 hover:text-white transition-colors text-xs"
                >
                  ▶▶
                </button>
              )}
              <button
                onClick={() => onSaveToPlaylist(item)}
                title="บันทึกลง playlist"
                className="p-1.5 rounded-lg bg-gray-700 hover:bg-blue-700 text-gray-400 hover:text-white transition-colors text-xs"
              >
                💾
              </button>
              <button
                onClick={() => onRemove(item.id)}
                title="ลบออกจากคิว"
                className="p-1.5 rounded-lg bg-gray-700 hover:bg-red-700 text-gray-400 hover:text-white transition-colors text-xs"
              >
                ✕
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
