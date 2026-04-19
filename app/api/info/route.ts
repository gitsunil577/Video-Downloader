import { NextRequest } from 'next/server'
import path from 'path'
import ytDlpExec from 'yt-dlp-exec'

export const runtime = 'nodejs'

// process.cwd() always returns the real project root — safe from Next.js path virtualization
function getYtDlpBin(): string {
  const bin = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  return path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', bin)
}

const allowedHosts = [
  'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com',
  'facebook.com', 'www.facebook.com', 'fb.watch', 'm.facebook.com',
  'instagram.com', 'www.instagram.com',
]

export async function POST(request: NextRequest) {
  const { url } = await request.json()

  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'URL is required' }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const host = parsedUrl.hostname
  if (!allowedHosts.includes(host)) {
    return Response.json({ error: 'Only YouTube, Facebook, and Instagram URLs are supported' }, { status: 400 })
  }

  // Create a yt-dlp instance with the correctly resolved binary path
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ytdlp = (ytDlpExec as any).create(getYtDlpBin())

  try {
    const info = await (ytdlp as (url: string, opts: object) => Promise<VideoInfo>)(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0'],
    })

    const formats: Format[] = []

    if (info.formats) {
      const seen = new Set<string>()
      for (const f of info.formats) {
        if (!f.url) continue
        if (f.vcodec === 'none') continue // skip audio-only

        const height = f.height || 0
        const label = height ? `${height}p` : (f.format_note || f.format_id)
        const key = `${label}-${f.ext}`
        if (seen.has(key)) continue
        seen.add(key)

        formats.push({
          format_id: f.format_id,
          ext: f.ext || 'mp4',
          height,
          label,
          filesize: f.filesize || f.filesize_approx || null,
          vcodec: f.vcodec,
          acodec: f.acodec,
          hasAudio: f.acodec !== 'none',
        })
      }
      formats.sort((a, b) => (b.height || 0) - (a.height || 0))
    }

    // Deduplicate by label, prefer formats with audio
    const deduped: Format[] = []
    const labelSeen = new Map<string, number>()
    for (const f of formats) {
      const idx = labelSeen.get(f.label)
      if (idx === undefined) {
        labelSeen.set(f.label, deduped.length)
        deduped.push(f)
      } else if (f.hasAudio && !deduped[idx].hasAudio) {
        deduped[idx] = f
      }
    }

    return Response.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      uploader: info.uploader,
      platform: detectPlatform(host),
      formats: deduped.slice(0, 8),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('yt-dlp error:', msg)
    return Response.json(
      { error: 'Could not fetch video info. Make sure the URL is valid and the video is public.' },
      { status: 500 }
    )
  }
}

function detectPlatform(host: string): string {
  if (host.includes('youtube') || host.includes('youtu.be')) return 'youtube'
  if (host.includes('facebook') || host.includes('fb.watch')) return 'facebook'
  if (host.includes('instagram')) return 'instagram'
  return 'unknown'
}

interface Format {
  format_id: string
  ext: string
  height: number
  label: string
  filesize: number | null
  vcodec: string
  acodec: string
  hasAudio: boolean
}

interface VideoInfo {
  title: string
  thumbnail: string
  duration: number
  uploader: string
  formats: Array<{
    format_id: string
    ext: string
    height: number
    format_note: string
    url: string
    vcodec: string
    acodec: string
    filesize?: number
    filesize_approx?: number
  }>
}
