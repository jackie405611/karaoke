'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import type { SearchResult } from '@/app/api/search/route'

interface Props {
  onAddSong: (videoId: string, title: string, thumbnail: string) => Promise<void>
}

export default function SearchPanel({ onAddSong }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError('')
    setResults([])
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'NO_API_KEY') {
          setError('ยังไม่ได้ตั้งค่า YOUTUBE_API_KEY ใน .env.local')
        } else {
          setError(data.error ?? 'เกิดข้อผิดพลาด')
        }
        return
      }
      setResults(data)
      if (data.length === 0) setError('ไม่พบเพลงที่ค้นหา')
    } catch {
      setError('ไม่สามารถเชื่อมต่อได้')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(result: SearchResult) {
    setAddingId(result.videoId)
    try {
      await onAddSong(result.videoId, result.title, result.thumbnail)
      setAddedIds((prev) => new Set(prev).add(result.videoId))
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search Input */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาชื่อเพลง / ศิลปิน เช่น คาราโอเกะ มาลีฮวนน่า"
          className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm"
          disabled={loading}
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
        >
          {loading ? '⏳' : '🔍 ค้นหา'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">
          {error === 'ยังไม่ได้ตั้งค่า YOUTUBE_API_KEY ใน .env.local' ? (
            <span>
              ⚠️ ยังไม่ได้ตั้งค่า <code className="bg-gray-800 px-1 rounded">YOUTUBE_API_KEY</code> ใน{' '}
              <code className="bg-gray-800 px-1 rounded">.env.local</code> —{' '}
              <a
                href="https://console.cloud.google.com/"
                target="_blank"
                rel="noreferrer"
                className="underline text-red-300 hover:text-red-200"
              >
                สร้าง API Key ที่นี่
              </a>
            </span>
          ) : (
            error
          )}
        </div>
      )}

      {/* Results Grid */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-72 overflow-y-auto pr-1">
          {results.map((r) => {
            const isAdding = addingId === r.videoId
            const isAdded = addedIds.has(r.videoId)
            return (
              <button
                key={r.videoId}
                onClick={() => !isAdded && !isAdding && handleAdd(r)}
                disabled={isAdding}
                className={`group relative flex flex-col rounded-xl overflow-hidden border text-left transition-all ${
                  isAdded
                    ? 'border-green-600 bg-green-900/20 cursor-default'
                    : 'border-gray-700 bg-gray-800/60 hover:border-red-500 hover:bg-gray-800 cursor-pointer'
                }`}
              >
                {/* Thumbnail */}
                <div className="relative w-full aspect-video bg-gray-700">
                  <Image
                    src={r.thumbnail}
                    alt={r.title}
                    fill
                    sizes="200px"
                    className="object-cover"
                    unoptimized
                  />
                  {/* Overlay */}
                  {!isAdded && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                      <span className="text-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAdding ? '⏳' : '＋'}
                      </span>
                    </div>
                  )}
                  {isAdded && (
                    <div className="absolute inset-0 bg-green-900/50 flex items-center justify-center">
                      <span className="text-2xl">✓</span>
                    </div>
                  )}
                </div>
                {/* Title */}
                <div className="p-2">
                  <p className="text-xs text-gray-200 line-clamp-2 leading-tight">{r.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{r.channelTitle}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
