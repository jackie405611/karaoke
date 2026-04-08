'use client'

import { useState } from 'react'
import SearchPanel from './SearchPanel'

interface Props {
  onAdded: () => void
}

type Tab = 'url' | 'search'

// Detect playlist URL on the client side (same logic as server)
function hasPlaylistId(url: string): boolean {
  return /[?&]list=[a-zA-Z0-9_-]+/.test(url)
}

// Extract video ID from a URL that may also have a list= param
function extractSingleVideoUrl(url: string): string | null {
  const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

export default function AddSongForm({ onAdded }: Props) {
  const [tab, setTab] = useState<Tab>('url')
  const [url, setUrl] = useState('')
  const [requester, setRequester] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [addAllPlaylist, setAddAllPlaylist] = useState(false)

  const isPlaylist = hasPlaylistId(url)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      // If it's a playlist URL but user only wants one song, extract the v= param
      let submitUrl = url.trim()
      if (isPlaylist && !addAllPlaylist) {
        const singleId = extractSingleVideoUrl(submitUrl)
        if (!singleId) {
          setError('URL นี้ไม่มี Video ID (v=) กรุณาเปิด Playlist แล้วเลือกเพลงที่ต้องการ หรือเปิด "เพิ่มทั้ง playlist"')
          setLoading(false)
          return
        }
        submitUrl = singleId
      }
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtube_url: submitUrl, requested_by: requester.trim() || 'Guest' }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'NO_API_KEY') {
          setError('ต้องตั้งค่า YOUTUBE_API_KEY ใน .env.local เพื่อเพิ่ม playlist')
        } else {
          setError(data.error ?? data.message ?? 'เกิดข้อผิดพลาด')
        }
      } else {
        setUrl('')
        if (data.batch) {
          setSuccess(`✅ เพิ่ม ${data.added} เพลงจาก playlist ลงคิวแล้ว`)
          setTimeout(() => setSuccess(''), 4000)
        }
        onAdded()
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddFromSearch(videoId: string) {
    const res = await fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtube_url: videoId, requested_by: requester.trim() || 'Guest' }),
    })
    if (!res.ok) throw new Error('Failed to add')
    onAdded()
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Tabs */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setTab('url')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'url'
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          🔗 วาง URL
        </button>
        <button
          onClick={() => setTab('search')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'search'
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          🔍 ค้นหาเพลง
        </button>

        <input
          type="text"
          value={requester}
          onChange={(e) => setRequester(e.target.value)}
          placeholder="ชื่อผู้ขอเพลง"
          className="ml-auto w-40 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm"
        />
      </div>

      {/* URL Tab */}
      {tab === 'url' && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setAddAllPlaylist(false) }}
                placeholder="วาง YouTube URL, Playlist URL หรือ Video ID"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm"
                disabled={loading}
                autoFocus
              />
              {/* Playlist badge */}
              {isPlaylist && !addAllPlaylist && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-blue-600 text-white rounded px-1.5 py-0.5 pointer-events-none">
                  📋 1 เพลง
                </span>
              )}
              {isPlaylist && addAllPlaylist && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-purple-600 text-white rounded px-1.5 py-0.5 pointer-events-none">
                  📋 ทั้ง Playlist
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              {loading
                ? '⏳ กำลังโหลด...'
                : isPlaylist && addAllPlaylist
                ? '＋ เพิ่มทั้ง Playlist'
                : '＋ เพิ่มเพลง'}
            </button>
          </div>

          {/* Playlist option: only shown when URL has list= */}
          {isPlaylist && (
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
              <input
                type="checkbox"
                checked={addAllPlaylist}
                onChange={(e) => setAddAllPlaylist(e.target.checked)}
                className="w-4 h-4 rounded accent-purple-500"
              />
              <span className={addAllPlaylist ? 'text-purple-300' : 'text-gray-400'}>
                เพิ่มทั้ง Playlist (ใช้ YouTube API Key)
              </span>
            </label>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {success && <p className="text-green-400 text-sm">{success}</p>}
        </form>
      )}

      {/* Search Tab */}
      {tab === 'search' && (
        <SearchPanel onAddSong={handleAddFromSearch} />
      )}
    </div>
  )
}
