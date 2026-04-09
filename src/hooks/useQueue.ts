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

  // Track the last seq we acted on so we only fire once per command
  const lastSeqRef = useRef<number>(-1)

  useEffect(() => {
    // SSE — used only for queue-update notifications
    const es = new EventSource('/api/events')
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'queue-update') onQueueUpdateRef.current()
      } catch {}
    }

    // Poll DB for player commands every 500 ms — reliable across all process configs
    const pollCommand = async () => {
      try {
        const res = await fetch('/api/player/state')
        if (!res.ok) return
        const { command, seq } = await res.json() as { command: 'play' | 'pause'; seq: number }
        if (lastSeqRef.current === -1) {
          // First poll — just record current seq, don't replay old command
          lastSeqRef.current = seq
          return
        }
        if (seq !== lastSeqRef.current) {
          lastSeqRef.current = seq
          onPlayerCommandRef.current(command)
        }
      } catch {}
    }

    // Backup queue poll every 2s — ensures display stays in sync even if SSE EventEmitter drops
    const pollQueue = () => onQueueUpdateRef.current()

    pollCommand()
    const commandInterval = setInterval(pollCommand, 500)
    const queueInterval   = setInterval(pollQueue, 2000)

    return () => {
      es.close()
      clearInterval(commandInterval)
      clearInterval(queueInterval)
    }
  }, [])
}
