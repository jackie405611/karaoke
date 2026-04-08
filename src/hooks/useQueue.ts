'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { QueueItem } from '@/types'

export function useQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)

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

    // SSE for real-time updates
    const es = new EventSource('/api/events')
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'queue-update') fetchQueue()
      } catch {}
    }
    es.onerror = () => {
      // Reconnects automatically — browser handles this
    }

    return () => es.close()
  }, [fetchQueue])

  return { queue, loading, fetchQueue }
}

export function usePlayerSSE(
  onQueueUpdate: () => void,
  onPlayerCommand: (cmd: 'play' | 'pause') => void
) {
  const onQueueUpdateRef = useRef(onQueueUpdate)
  const onPlayerCommandRef = useRef(onPlayerCommand)
  onQueueUpdateRef.current = onQueueUpdate
  onPlayerCommandRef.current = onPlayerCommand

  useEffect(() => {
    const es = new EventSource('/api/events')
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'queue-update') onQueueUpdateRef.current()
        if (data.type === 'player-command') onPlayerCommandRef.current(data.command)
      } catch {}
    }
    return () => es.close()
  }, [])
}
