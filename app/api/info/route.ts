import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { getYtDlpBin, youtubeBypassArgs, allowedHosts, withRetry } from '../ytdlp-helpers'

export const runtime = 'nodejs'

function runYtDlpJson(url: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      '--dump-single-json',
      '--no-check-certificates',
      '--no-warnings',
      '--no-playlist',
      ...youtubeBypassArgs(),
    ]

    let stdout = ''
    let stderr = ''
    const proc = spawn(getYtDlpBin(), args)
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) {
        try { resolve(JSON.parse(stdout)) }
        catch (e) { reject(e) }
      } else {
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`))
      }
    })
  })
}

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

  try {
    const info = await withRetry(() => runYtDlpJson(url))

    const formats: Format[] = []

    if (info.formats) {
      const seen = new Set<string>()
      for (const f of info.formats) {
        if (!f.url) continue
        if (f.vcodec === 'none') continue

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

    const isBot = msg.includes('Sign in') || msg.includes('bot')
    const userMsg = isBot
      ? 'YouTube is blocking automated access. Add a cookies.txt file to the project root to fix this — see the console for instructions.'
      : 'Could not fetch video info. Make sure the URL is valid and the video is public.'

    return Response.json({ error: userMsg }, { status: 500 })
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
