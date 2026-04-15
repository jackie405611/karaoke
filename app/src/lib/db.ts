import { neon } from '@neondatabase/serverless'

type Row = Record<string, unknown>
type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>

let _fn: SqlFn | null = null

// Lazy init — safe for Next.js build time
// Returns a tagged-template function that always resolves to Row[]
export function getDb(): SqlFn {
  if (!_fn) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL environment variable is not set')
    const sql = neon(url)
    _fn = (strings, ...values) => sql(strings, ...values) as Promise<Row[]>
  }
  return _fn
}
