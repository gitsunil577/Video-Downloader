import path from 'path'
import fs from 'fs'

export function getYtDlpBin(): string {
  const bin = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  return path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', bin)
}

export function getFfmpegBin(): string {
  const ext = process.platform === 'win32' ? '.exe' : ''
  return path.join(process.cwd(), 'node_modules', 'ffmpeg-static', `ffmpeg${ext}`)
}

/**
 * Extra yt-dlp args applied to every YouTube request.
 *
 * Bot detection fix: if cookies.txt exists at the project root it is passed
 * automatically. To generate one:
 *   1. Install the "Get cookies.txt LOCALLY" browser extension in Chrome/Firefox.
 *   2. Go to youtube.com while signed in.
 *   3. Export cookies → save the file as  <project-root>/cookies.txt
 *
 * NOTE: do NOT add --extractor-args youtube:player_client=ios here — that flag
 * limits yt-dlp to the iOS API which returns only storyboard thumbnails, not
 * actual video/audio streams.
 */
export function youtubeBypassArgs(): string[] {
  const cookiesPath = path.join(process.cwd(), 'cookies.txt')
  if (fs.existsSync(cookiesPath)) {
    return ['--cookies', cookiesPath]
  }
  return []
}

/** Re-run `fn` up to `times` times on transient network/DNS errors. */
export async function withRetry<T>(fn: () => Promise<T>, times = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < times; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      const isTransient =
        msg.includes('getaddrinfo') ||
        msg.includes('ENOTFOUND') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('Failed to resolve') ||
        msg.includes('Network') ||
        msg.includes('temporarily unavailable')
      if (!isTransient || i === times - 1) break
      await new Promise(r => setTimeout(r, 1500 * (i + 1)))
    }
  }
  throw lastErr
}

export const allowedHosts = [
  'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com',
  'facebook.com', 'www.facebook.com', 'fb.watch', 'm.facebook.com',
  'instagram.com', 'www.instagram.com',
]
