/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hay otro pnpm-lock.yaml más arriba (en el home): la raíz es este proyecto
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
