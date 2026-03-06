/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
    NEXT_PUBLIC_WEBRTC_SERVER: process.env.NEXT_PUBLIC_WEBRTC_SERVER || 'wss://101.50.86.185:8089/ws',
  },
}

module.exports = nextConfig
