/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hay otro pnpm-lock.yaml más arriba (en el home): la raíz es este proyecto
  turbopack: {
    root: import.meta.dirname,
  },
  // En desarrollo, el indicador de Next tapaba el botón "Cuenta" de la barra lateral
  devIndicators: {
    position: "bottom-right",
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
