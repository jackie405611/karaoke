import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Match exactly /[roomCode] — 6 alphanumeric chars, no sub-paths
  // Static routes like /api/* and /_next/* are excluded by the matcher config below
  const match = pathname.match(/^\/([A-Za-z0-9]{6})$/)
  if (match) {
    const roomCode = match[1].toUpperCase()
    const token = req.cookies.get(`karaoke_host_${roomCode}`)?.value
    if (!token) {
      // Guest — redirect to remote view
      return NextResponse.redirect(new URL(`/${roomCode}/remote`, req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and API routes
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
