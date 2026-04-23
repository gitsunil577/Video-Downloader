"use client"

import { useState, useRef } from "react"

interface Format {
  format_id: string
  ext: string
  height: number
  label: string
  filesize: number | null
  hasAudio: boolean
}

interface VideoInfo {
  title: string
  thumbnail: string
  duration: number
  uploader: string
  platform: "youtube" | "facebook" | "instagram" | "unknown"
  formats: Format[]
}

function formatDuration(seconds: number): string {
  if (!seconds) return ""
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

function formatFilesize(bytes: number | null): string {
  if (!bytes) return ""
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function detectPlatformFromUrl(url: string): "youtube" | "facebook" | "instagram" | null {
  try {
    const { hostname } = new URL(url)
    if (hostname.includes("youtube") || hostname.includes("youtu.be")) return "youtube"
    if (hostname.includes("facebook") || hostname.includes("fb.watch")) return "facebook"
    if (hostname.includes("instagram")) return "instagram"
  } catch {}
  return null
}

const PlatformIcon = ({ platform }: { platform: string }) => {
  if (platform === "youtube") return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
  )
  if (platform === "facebook") return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
  )
  if (platform === "instagram") return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
  )
  return null
}

const platformColors: Record<string, string> = {
  youtube: "text-red-500",
  facebook: "text-blue-600",
  instagram: "text-pink-500",
}

const platformBg: Record<string, string> = {
  youtube: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
  facebook: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
  instagram: "bg-pink-50 border-pink-200 dark:bg-pink-950/30 dark:border-pink-800",
}

export default function Home() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [selectedFormat, setSelectedFormat] = useState("")
  const [downloading, setDownloading] = useState<"mp4" | "mp3" | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadError, setDownloadError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const detectedPlatform = detectPlatformFromUrl(url)

  async function handleFetch() {
    if (!url.trim()) return
    setLoading(true)
    setError("")
    setVideoInfo(null)

    try {
      const res = await fetch("/api/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fetch video info")
      setVideoInfo(data)
      setSelectedFormat(data.formats?.[0]?.format_id || "")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function triggerDownload(type: "mp4" | "mp3") {
    if (!url || !videoInfo || downloading) return
    setDownloading(type)
    setDownloadProgress(0)
    setDownloadError("")

    const safeTitle = videoInfo.title.replace(/[^\w\s-]/g, "").trim() || "video"
    const params = new URLSearchParams({ url: url.trim(), format_id: selectedFormat, type })

    try {
      const res = await fetch(`/api/download?${params}`)
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Download failed")
      }

      const contentLength = res.headers.get("Content-Length")
      const total = contentLength ? parseInt(contentLength, 10) : 0
      const reader = res.body!.getReader()
      const chunks: Uint8Array[] = []
      let received = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        if (total > 0) setDownloadProgress(Math.round((received / total) * 100))
      }

      const mimeType = type === "mp4" ? "video/mp4" : "audio/mpeg"
      const blob = new Blob(chunks, { type: mimeType })
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = `${safeTitle}.${type}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)
    } catch (e: unknown) {
      setDownloadError(e instanceof Error ? e.message : "Download failed — please try again")
    } finally {
      setDownloading(null)
      setDownloadProgress(0)
    }
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
    } catch {
      inputRef.current?.focus()
    }
  }

  function handleReset() {
    setUrl("")
    setVideoInfo(null)
    setError("")
    setSelectedFormat("")
    setDownloading(null)
    setDownloadProgress(0)
    setDownloadError("")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
          </div>
          <span className="text-white font-bold text-lg">VidSave</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/50">
          <span className="flex items-center gap-1.5"><span className={`text-red-400`}><PlatformIcon platform="youtube" /></span> YouTube</span>
          <span className="flex items-center gap-1.5"><span className={`text-blue-400`}><PlatformIcon platform="facebook" /></span> Facebook</span>
          <span className="flex items-center gap-1.5"><span className={`text-pink-400`}><PlatformIcon platform="instagram" /></span> Instagram</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
            Download Videos from{" "}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Anywhere
            </span>
          </h1>
          <p className="text-white/60 text-lg">
            Paste a YouTube, Facebook, or Instagram link and download in your preferred quality.
          </p>
        </div>

        {/* Input card */}
        <div className="w-full max-w-2xl bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-2xl">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setVideoInfo(null); setError("") }}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                placeholder="Paste video URL here..."
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-24 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              />
              {/* Platform badge */}
              {detectedPlatform && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 ${platformColors[detectedPlatform]} opacity-80`}>
                  <PlatformIcon platform={detectedPlatform} />
                </span>
              )}
            </div>
            <button
              onClick={handlePaste}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white/70 text-sm font-medium transition whitespace-nowrap"
            >
              Paste
            </button>
          </div>

          <button
            onClick={handleFetch}
            disabled={!url.trim() || loading}
            className="mt-3 w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold text-base transition shadow-lg shadow-purple-900/30"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Fetching video info...
              </span>
            ) : "Get Video"}
          </button>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Video info */}
          {videoInfo && (
            <div className={`mt-5 rounded-xl border p-4 ${platformBg[videoInfo.platform] || "bg-white/5 border-white/10"}`}>
              <div className="flex gap-4">
                {videoInfo.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={videoInfo.thumbnail}
                    alt="thumbnail"
                    className="w-32 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className={`flex items-center gap-1.5 mb-1 text-xs font-medium ${platformColors[videoInfo.platform]}`}>
                    <PlatformIcon platform={videoInfo.platform} />
                    <span className="capitalize">{videoInfo.platform}</span>
                  </div>
                  <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2">{videoInfo.title}</h3>
                  <div className="flex items-center gap-3 mt-1.5 text-white/50 text-xs">
                    {videoInfo.uploader && <span>{videoInfo.uploader}</span>}
                    {videoInfo.duration > 0 && <span>{formatDuration(videoInfo.duration)}</span>}
                  </div>
                </div>
              </div>

              {/* Format selector */}
              {videoInfo.formats.length > 0 && (
                <div className="mt-4">
                  <p className="text-white/60 text-xs mb-2 font-medium">Select Quality</p>
                  <div className="flex flex-wrap gap-2">
                    {videoInfo.formats.map((f) => (
                      <button
                        key={f.format_id}
                        onClick={() => setSelectedFormat(f.format_id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          selectedFormat === f.format_id
                            ? "bg-purple-600 border-purple-500 text-white"
                            : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20"
                        }`}
                      >
                        {f.label}
                        {f.filesize ? ` · ${formatFilesize(f.filesize)}` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Download buttons */}
              <div className="mt-4 flex gap-2 flex-wrap">
                {/* MP4 with audio */}
                <button
                  onClick={() => triggerDownload("mp4")}
                  disabled={downloading !== null}
                  className="flex-1 min-w-[140px] py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-white font-semibold text-sm transition flex items-center justify-center gap-2"
                >
                  {downloading === "mp4" ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      {downloadProgress > 0 ? `Downloading ${downloadProgress}%` : "Processing..."}
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                      Download MP4
                    </>
                  )}
                </button>

                {/* MP3 audio only */}
                <button
                  onClick={() => triggerDownload("mp3")}
                  disabled={downloading !== null}
                  className="flex-1 min-w-[140px] py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-white font-semibold text-sm transition flex items-center justify-center gap-2"
                >
                  {downloading === "mp3" ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      {downloadProgress > 0 ? `Downloading ${downloadProgress}%` : "Processing..."}
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                      Download MP3
                    </>
                  )}
                </button>

                <button
                  onClick={handleReset}
                  disabled={downloading !== null}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed border border-white/20 rounded-xl text-white/60 text-sm transition"
                >
                  Reset
                </button>
              </div>

              {/* Progress bar */}
              {downloading && (
                <div className="mt-3">
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                      style={{ width: downloadProgress > 0 ? `${downloadProgress}%` : "30%" }}
                    />
                  </div>
                  <p className="mt-1.5 text-center text-white/40 text-xs">
                    {downloadProgress > 0
                      ? `Transferring file… ${downloadProgress}%`
                      : "Server is processing (merging video + audio)… please wait"}
                  </p>
                </div>
              )}

              {/* Download error */}
              {downloadError && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
                  {downloadError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Supported platforms */}
        <div className="mt-8 flex items-center gap-6 text-white/30 text-sm">
          <div className="flex items-center gap-1.5 text-red-400/70">
            <PlatformIcon platform="youtube" />
            <span>YouTube</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1.5 text-blue-400/70">
            <PlatformIcon platform="facebook" />
            <span>Facebook</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1.5 text-pink-400/70">
            <PlatformIcon platform="instagram" />
            <span>Instagram</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-white/20 text-xs border-t border-white/5">
        For personal use only. Respect copyright and platform terms of service.
      </footer>
    </div>
  )
}
