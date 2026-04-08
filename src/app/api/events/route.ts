import { emitter } from '@/lib/events'

export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()
  let cleanup: (() => void) | undefined

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // client already disconnected
        }
      }

      // Initial heartbeat so client knows connection is live
      send({ type: 'connected' })

      const onQueueUpdate = () => send({ type: 'queue-update' })
      const onPlayerCommand = (command: string) => send({ type: 'player-command', command })

      emitter.on('queue-update', onQueueUpdate)
      emitter.on('player-command', onPlayerCommand)

      // Keepalive ping every 25s to prevent proxy/browser timeouts
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          clearInterval(keepalive)
        }
      }, 25_000)

      cleanup = () => {
        clearInterval(keepalive)
        emitter.off('queue-update', onQueueUpdate)
        emitter.off('player-command', onPlayerCommand)
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
