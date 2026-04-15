import { redirect } from 'next/navigation'

// Legacy redirect — remote page moved to /[roomCode]/remote
export default function RemoteRedirect() {
  redirect('/LEGACY/remote')
}
