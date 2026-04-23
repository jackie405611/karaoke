type Bucket = {
  count: number
  windowStartMs: number
}

type DedupeEntry = {
  expiresAtMs: number
}

const rateBuckets = new Map<string, Bucket>()
const dedupeEntries = new Map<string, DedupeEntry>()

function nowMs() {
  return Date.now()
}

function gcExpiredDedupe(currentMs: number) {
  for (const [key, entry] of dedupeEntries) {
    if (entry.expiresAtMs <= currentMs) dedupeEntries.delete(key)
  }
}

function gcOldRateBuckets(currentMs: number) {
  for (const [key, bucket] of rateBuckets) {
    if (currentMs - bucket.windowStartMs > 120_000) rateBuckets.delete(key)
  }
}

export function getClientFingerprint(forwardedFor: string | null, userAgent: string | null) {
  const ip = (forwardedFor ?? 'unknown').split(',')[0]?.trim() || 'unknown'
  const ua = (userAgent ?? 'unknown').slice(0, 60)
  return `${ip}|${ua}`
}

export function checkRateLimit(input: {
  roomCode: string
  actor: string
  action: string
  maxRequests: number
  windowMs: number
}) {
  const currentMs = nowMs()
  gcOldRateBuckets(currentMs)

  const key = `${input.roomCode.toUpperCase()}|${input.actor}|${input.action}`
  const bucket = rateBuckets.get(key)
  if (!bucket || currentMs - bucket.windowStartMs >= input.windowMs) {
    rateBuckets.set(key, { count: 1, windowStartMs: currentMs })
    return { allowed: true, remaining: input.maxRequests - 1 }
  }

  if (bucket.count >= input.maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  bucket.count += 1
  rateBuckets.set(key, bucket)
  return { allowed: true, remaining: Math.max(input.maxRequests - bucket.count, 0) }
}

export function checkDedupe(input: {
  roomCode: string
  actor: string
  action: string
  dedupeWindowMs: number
}) {
  const currentMs = nowMs()
  gcExpiredDedupe(currentMs)

  const key = `${input.roomCode.toUpperCase()}|${input.actor}|${input.action}`
  const entry = dedupeEntries.get(key)
  if (entry && entry.expiresAtMs > currentMs) return { allowed: false }

  dedupeEntries.set(key, { expiresAtMs: currentMs + input.dedupeWindowMs })
  return { allowed: true }
}
