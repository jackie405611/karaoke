import { EventEmitter } from 'events'

// Singleton event emitter — shared across all API route handlers in the same process
const emitter = new EventEmitter()
emitter.setMaxListeners(100) // support many concurrent SSE clients

export function notifyQueueUpdate() {
  emitter.emit('queue-update')
}

export function notifyPlayerCommand(command: 'play' | 'pause' | 'restart') {
  emitter.emit('player-command', command)
}

export { emitter }
