export interface Video {
  id: number
  youtube_video_id: string
  title: string
  thumbnail: string
  duration: string
  created_at: string
}

export interface QueueItem {
  id: number
  video_id: number
  queue_order: number
  status: 'queued' | 'playing' | 'done'
  requested_by: string
  created_at: string
  // joined from videos
  youtube_video_id: string
  title: string
  thumbnail: string
  duration: string
}

export interface AddSongPayload {
  youtube_url: string
  requested_by?: string
}

export interface Playlist {
  id: number
  name: string
  description: string
  created_at: string
  item_count: number
}

export interface PlaylistItem {
  id: number
  playlist_id: number
  video_id: number
  item_order: number
  created_at: string
  // joined from videos
  youtube_video_id: string
  title: string
  thumbnail: string
  duration: string
}
