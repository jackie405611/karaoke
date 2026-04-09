'use client'

import { useState } from 'react'
import SearchPanel from './SearchPanel'

interface Props {
  onAdded: () => void
}

type Tab = 'url' | 'search'

function hasPlaylistId(url: string): boolean {
  return /[?&]list=[a-zA-Z0-9_-]+/.test(url)
}

function extractSingleVideoId(url: string): string | null {
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
  // null = not showing choice, true = waiting for user to pick
  const [showChoice, setShowChoice] = useState(false)

  const isPlaylist = hasPlaylistId(url)

  // Called when form is submitted — if playlist URL, show choice dialog instead
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || loading) return
    if (isPlaylist) {
      setShowChoice(true)
      setError('')
      return
    }
    doAdd(url.trim())
  }

  async function doAdd(submitUrl: string) {
    setShowChoice(false)
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtube_url: submitUrl, requested_by: requester.trim() || 'Guest' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(
          data.error === 'NO_API_KEY'
            ? 'ต้องตั้งค่า YOUTUBE_API_KEY เพื่อเพิ่มทั้ง Playlist'
            : (data.error ?? data.message ?? 'เกิดข้อผิดพลาด')
        )
      } else {
        setUrl('')
        if (data.batch) {
          setSuccess(`✅ เพิ่ม ${data.added} เพลงจาก Playlist ลงคิวแล้ว`)
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

  function handleChooseSingle() {
    const singleId = extractSingleVideoId(url)
    if (!singleId) {
      setShowChoice(false)
      setError('URL นี้ไม่มี Video ID (v=) — ลองเปิดเพลงนั้นใน YouTube แล้วคัดลอก URL ใหม่')
      return
    }
    doAdd(singleId)
  }

  function handleChooseAll() {
    doAdd(url.trim())
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
        <div className="flex flex-col gap-2">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setShowChoice(false) }}
                placeholder="วาง YouTube URL, Playlist URL หรือ Video ID"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm pr-24"
                disabled={loading}
                autoFocus
              />
              {isPlaylist && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-blue-700 text-white rounded px-1.5 py-0.5 pointer-events-none">
                  📋 Playlist
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              {loading ? '⏳ กำลังโหลด...' : '＋ เพิ่มเพลง'}
            </button>
          </form>

          {/* Playlist choice panel */}
          {showChoice && isPlaylist && (
            <div className="flex flex-col gap-2 bg-gray-800 border border-blue-700/60 rounded-xl p-3">
              <p className="text-sm text-gray-300 font-medium">📋 พบ Playlist — ต้องการเพิ่มแบบไหน?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleChooseSingle}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  🎵 เพิ่มแค่เพลงนี้
                </button>
                <button
                  onClick={handleChooseAll}
                  className="flex-1 bg-blue-700 hover:bg-blue-600 active:bg-blue-500 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  📋 เพิ่มทั้ง Playlist
                </button>
              </div>
              <button
                onClick={() => setShowChoice(false)}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors self-end"
              >
                ยกเลิก
              </button>
            </div>
          )}

          {error   && <p className="text-red-400 text-sm">{error}</p>}
          {success && <p className="text-green-400 text-sm">{success}</p>}
        </div>
      )}

      {/* Search Tab */}
      {tab === 'search' && (
        <SearchPanel onAddSong={handleAddFromSearch} />
      )}
    </div>
  )
}
