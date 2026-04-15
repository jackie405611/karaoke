'use client'

interface Props {
  isPlaying: boolean
  hasPrev: boolean
  hasNext: boolean
  onPlayPause: () => void
  onNext: () => void
  onPrev: () => void
  onFullscreen: () => void
}

export default function PlayerControls({
  isPlaying,
  hasPrev,
  hasNext,
  onPlayPause,
  onNext,
  onPrev,
  onFullscreen,
}: Props) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        title="เพลงก่อนหน้า"
        className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-lg transition-colors"
      >
        ⏮
      </button>

      <button
        onClick={onPlayPause}
        title={isPlaying ? 'หยุดชั่วคราว' : 'เล่น'}
        className="w-16 h-16 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-500 text-white text-2xl shadow-lg shadow-red-900/50 transition-colors"
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <button
        onClick={onNext}
        disabled={!hasNext}
        title="เพลงถัดไป"
        className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-lg transition-colors"
      >
        ⏭
      </button>

      <button
        onClick={onFullscreen}
        title="เต็มจอ"
        className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-white text-lg transition-colors"
      >
        ⛶
      </button>
    </div>
  )
}
