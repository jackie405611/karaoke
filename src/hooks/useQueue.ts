'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { QueueItem } from '@/types'

export function useQueue(roomCode: string) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [queueHash, setQueueHash] = useState('')

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`/api/queue?room=${roomCode}`)
      const data = await res.json()
      const hash = res.headers.get('X-Queue-Hash') ?? ''
      if (hash) setQueueHash(hash)
      setQueue(data)
    } catch {
      console.error('Failed to fetch queue')
    } finally {
      setLoading(false)
    }
  }, [roomCode])

  useEffect(() => {
    fetchQueue()

    const es = new EventSource(`/api/events?room=${roomCode}`)
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
  }, [roomCode, fetchQueue])

  return { queue, loading, fetchQueue, queueHash }
}

export function usePlayerSSE(
  roomCode: string,
  onQueueUpdate: () => void,
  onPlayerCommand: (cmd: 'play' | 'pause' | 'restart') => void
) {
  const onQueueUpdateRef = useRef(onQueueUpdate)
  const onPlayerCommandRef = useRef(onPlayerCommand)

  useEffect(() => {
    onQueueUpdateRef.current = onQueueUpdate
    onPlayerCommandRef.current = onPlayerCommand
  }, [onQueueUpdate, onPlayerCommand])

  const lastSeqRef = useRef<number>(-1)
  const lastQueueHashRef = useRef<string>('')

  useEffect(() => {
    const es = new EventSource(`/api/events?room=${roomCode}`)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'queue-update') onQueueUpdateRef.current()
        if (data.type === 'player-command') {
          lastSeqRef.current = -2
          onPlayerCommandRef.current(data.command)
        }
      } catch {}
    }

    const pollCommand = async () => {
      try {
        const res = await fetch(`/api/player/state?room=${roomCode}`)
        if (!res.ok) return

        const queueHash = res.headers.get('X-Queue-Hash') ?? ''
        if (queueHash && queueHash !== lastQueueHashRef.current) {
          lastQueueHashRef.current = queueHash
          onQueueUpdateRef.current()
        }

        const { command, seq } = await res.json() as { command: 'play' | 'pause' | 'restart'; seq: number }
        if (lastSeqRef.current === -1 || lastSeqRef.current === -2) {
          lastSeqRef.current = seq
          return
        }
        if (seq !== lastSeqRef.current) {
          lastSeqRef.current = seq
          onPlayerCommandRef.current(command)
        }
      } catch {}
    }

    pollCommand()
    const commandInterval = setInterval(pollCommand, 500)

    return () => {
      es.close()
      clearInterval(commandInterval)
    }
  }, [roomCode])
}
