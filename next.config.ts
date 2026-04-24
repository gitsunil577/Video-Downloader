import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static", "yt-dlp-exec"],
};

export default nextConfig;
