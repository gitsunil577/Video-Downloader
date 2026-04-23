import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getYtDlpBin, getFfmpegBin, youtubeBypassArgs, allowedHosts, withRetry } from '../ytdlp-helpers'

export const runtime = 'nodejs'
export const maxDuration = 300  // 5 min — requires Vercel Pro; Hobby cap is 60s

function runYtDlp(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(getYtDlpBin(), args)
    proc.stderr.on('data', (d: Buffer) => console.error('[yt-dlp]', d.toString()))
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`yt-dlp exited with code ${code}`))
    })
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const url = searchParams.get('url')
  const formatId = searchParams.get('format_id') || ''
  const type = searchParams.get('type') || 'mp4'  // 'mp4' | 'mp3'

  if (!url) return new Response('URL is required', { status: 400 })

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return new Response('Invalid URL', { status: 400 })
  }

  if (!allowedHosts.includes(parsedUrl.hostname)) {
    return new Response('Platform not supported', { status: 400 })
  }

  const tmpDir = os.tmpdir()
  const tmpId = `vidsave_${Date.now()}_${Math.random().toString(36).slice(2)}`

  try {
    if (type === 'mp3') {
      // ── Audio (MP3) ──────────────────────────────────────────────────────
      const outFile = path.join(tmpDir, `${tmpId}.mp3`)

      await withRetry(() => runYtDlp([
        url,
        '--ffmpeg-location', getFfmpegBin(),
        '-f', 'bestaudio/best',
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--no-playlist',
        '--no-warnings',
        '--no-check-certificates',
        ...youtubeBypassArgs(),
        '-o', outFile,
      ]))

      return streamFile(outFile, 'audio/mpeg', 'audio.mp3')

    } else {
      const formatSelector = formatId
        ? `${formatId}+bestaudio[ext=m4a]/${formatId}+bestaudio/best[height<=${heightFromFormatId(formatId)}][ext=mp4]/best`
        : 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best'

      const outFile = path.join(tmpDir, `${tmpId}.mp4`)

      await withRetry(() => runYtDlp([
        url,
        '--ffmpeg-location', getFfmpegBin(),
        '-f', formatSelector,
        '--merge-output-format', 'mp4',
        '--no-playlist',
        '--no-warnings',
        '--no-check-certificates',
        ...youtubeBypassArgs(),
        '-o', outFile,
      ]))

      return streamFile(outFile, 'video/mp4', 'video.mp4')
    }
  } catch (err) {
    console.error('Download error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    const isBot = msg.includes('Sign in') || msg.includes('bot')
    const userMsg = isBot
      ? 'YouTube is blocking this request. Add a cookies.txt file to the project root — see server logs for instructions.'
      : 'Download failed. The video may be unavailable or restricted.'
    return new Response(userMsg, { status: 500 })
  }
}

/** Stream a file to the client, then delete it from disk. */
function streamFile(filePath: string, contentType: string, filename: string): Response {
  const stat = fs.statSync(filePath)
  const fileStream = fs.createReadStream(filePath)

  const web = new ReadableStream({
    start(controller) {
      fileStream.on('data', (chunk) => controller.enqueue(chunk as Uint8Array))
      fileStream.on('end', () => {
        controller.close()
        fs.unlink(filePath, () => {})   // cleanup after stream ends
      })
      fileStream.on('error', (err) => {
        controller.error(err)
        fs.unlink(filePath, () => {})
      })
    },
    cancel() {
      fileStream.destroy()
      fs.unlink(filePath, () => {})
    },
  })

  return new Response(web, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(stat.size),
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

/** Try to extract a max height from a known format_id like "137" (1080p). Falls back to 9999. */
function heightFromFormatId(_id: string): number {
  return 9999
}
