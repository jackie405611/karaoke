import { redirect } from 'next/navigation'

// Legacy redirect — display page moved to /[roomCode]/display
export default function DisplayRedirect() {
  redirect('/LEGACY/display')
}
