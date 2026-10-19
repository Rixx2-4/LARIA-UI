import { backendRewrites } from "./lib/backend-proxy.mjs"

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
  // La API usa rutas con barra final ("/chats/"); Next la quitaría con un 308 antes
  // de llegar al proxy de /backend
  skipTrailingSlashRedirect: true,
  experimental: {
    // Next corta a 10 MB los cuerpos que pasan por proxy.ts y por el proxy de /backend;
    // la API admite documentos de 25 MB (más la cabecera del formulario)
    proxyClientMaxBodySize: "26mb",
  },
  // Proxy hacia la API (ver lib/backend-proxy.mjs). Sin LARIA_API_ORIGIN no hay
  // ninguno y la web llama directamente a NEXT_PUBLIC_LARIA_API_URL
  async rewrites() {
    return backendRewrites(process.env.LARIA_API_ORIGIN)
  },
}

export default nextConfig
