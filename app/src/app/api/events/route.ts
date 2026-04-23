import { NextRequest } from 'next/server'
import { emitter } from '@/lib/events'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const roomCode = (req.nextUrl.searchParams.get('room') ?? '').toUpperCase()

  const encoder = new TextEncoder()
  let cleanup: (() => void) | undefined

  const queueEvent  = `room:${roomCode}:queue-update`
  const playerEvent = `room:${roomCode}:player-command`
  const uiEvent     = `room:${roomCode}:ui-command`

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // client already disconnected
        }
      }

      send({ type: 'connected' })

      const onQueueUpdate  = () => send({ type: 'queue-update' })
      const onPlayerCommand = (command: string) => send({ type: 'player-command', command })
      const onUiCommand    = (payload: object) => send({ type: 'ui-command', ...payload })

      emitter.on(queueEvent, onQueueUpdate)
      emitter.on(playerEvent, onPlayerCommand)
      emitter.on(uiEvent, onUiCommand)

      // Keepalive ping every 20s for better proxy/mobile network compatibility
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          clearInterval(keepalive)
        }
      }, 20_000)

      cleanup = () => {
        clearInterval(keepalive)
        emitter.off(queueEvent, onQueueUpdate)
        emitter.off(playerEvent, onPlayerCommand)
        emitter.off(uiEvent, onUiCommand)
      }
    },
    cancel() {
      cleanup?.()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
