import { EventEmitter } from 'events'

// Singleton event emitter — shared across all API route handlers in the same process
const emitter = new EventEmitter()
emitter.setMaxListeners(500) // support many rooms × many concurrent SSE clients

export function notifyQueueUpdate(roomCode: string) {
  emitter.emit(`room:${roomCode.toUpperCase()}:queue-update`)
}

export function notifyPlayerCommand(roomCode: string, command: 'play' | 'pause' | 'restart') {
  emitter.emit(`room:${roomCode.toUpperCase()}:player-command`, command)
}

export { emitter }
