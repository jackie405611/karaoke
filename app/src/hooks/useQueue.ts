'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { QueueItem } from '@/types'

export function useQueue(roomCode: string, onPlayerCommand?: (cmd: string) => void) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const onPlayerCommandRef = useRef(onPlayerCommand)
  onPlayerCommandRef.current = onPlayerCommand

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`/api/queue?room=${roomCode}`)
      const data = await res.json()
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
        if (data.type === 'player-command') onPlayerCommandRef.current?.(data.command)
      } catch {}
    }
    es.onerror = () => {
      // Reconnects automatically — browser handles this
    }

    return () => es.close()
  }, [roomCode, fetchQueue])

  return { queue, loading, fetchQueue }
}

export function useRemote(roomCode: string) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [playerCommand, setPlayerCommand] = useState<'play' | 'pause' | 'restart'>('play')
  const [connected, setConnected] = useState(true)
  const [roomExpired, setRoomExpired] = useState(false)
  const [queueVisible, setQueueVisible] = useState(true)

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`/api/queue?room=${roomCode}`)
      const data = await res.json()
      setQueue(Array.isArray(data) ? data : [])
    } catch {
      // keep existing queue on transient network error
    } finally {
      setLoading(false)
    }
  }, [roomCode])

  useEffect(() => {
    fetchQueue()

    fetch(`/api/player/state?room=${roomCode}`)
      .then((r) => r.json())
      .then(({ command, queue_visible }) => {
        if (command === 'play' || command === 'pause' || command === 'restart') {
          setPlayerCommand(command)
        }
        if (typeof queue_visible === 'boolean') setQueueVisible(queue_visible)
      })
      .catch(() => {})

    const es = new EventSource(`/api/events?room=${roomCode}`)
    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)
    es.onmessage = (e) => {
      setConnected(true)
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'queue-update') fetchQueue()
        if (data.type === 'player-command') {
          const cmd = data.command as 'play' | 'pause' | 'restart'
          setPlayerCommand(cmd)
        }
        if (data.type === 'ui-command' && data.action === 'queue_visible') {
          setQueueVisible(data.visible as boolean)
        }
      } catch {}
    }

    return () => es.close()
  }, [roomCode, fetchQueue])

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomCode}`)
        if (res.status === 404) setRoomExpired(true)
      } catch {}
    }
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [roomCode])

  return {
    queue,
    loading,
    fetchQueue,
    playerCommand,
    isPlaying: playerCommand === 'play' || playerCommand === 'restart',
    connected,
    roomExpired,
    queueVisible,
    setQueueVisible,
  }
}

export function usePlayerSSE(
  roomCode: string,
  onQueueUpdate: () => void,
  onPlayerCommand: (cmd: 'play' | 'pause' | 'restart') => void,
  onUiCommand?: (action: string, visible: boolean) => void
) {
  const onQueueUpdateRef = useRef(onQueueUpdate)
  const onPlayerCommandRef = useRef(onPlayerCommand)
  const onUiCommandRef = useRef(onUiCommand)
  onQueueUpdateRef.current = onQueueUpdate
  onPlayerCommandRef.current = onPlayerCommand
  onUiCommandRef.current = onUiCommand

  const lastSeqRef = useRef<number>(-1)

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
        if (data.type === 'ui-command' && data.action === 'queue_visible') {
          onUiCommandRef.current?.(data.action, data.visible as boolean)
        }
      } catch {}
    }

    const pollCommand = async () => {
      try {
        const res = await fetch(`/api/player/state?room=${roomCode}`)
        if (!res.ok) return
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

    const pollQueue = () => onQueueUpdateRef.current()

    pollCommand()
    const commandInterval = setInterval(pollCommand, 500)
    const queueInterval   = setInterval(pollQueue, 2000)

    return () => {
      es.close()
      clearInterval(commandInterval)
      clearInterval(queueInterval)
    }
  }, [roomCode])
}
