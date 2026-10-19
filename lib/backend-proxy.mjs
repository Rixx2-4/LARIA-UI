// Proxy inverso hacia la API: el navegador llama a /backend/… en el dominio de la web
// y Vercel lo reenvía al backend. Así el navegador no ve la URL de Render ni hace
// peticiones previas de CORS, y un 502 mientras Render despierta llega como 502 (no
// como «Failed to fetch»). No es una barrera de seguridad: la API sigue siendo
// pública en Render y es ella quien exige el token.
//
// El destino sale de una variable de servidor (LARIA_API_ORIGIN, sin NEXT_PUBLIC_) y
// es fijo: nada de la petición elige a qué host se reenvía, así que no sirve de
// proxy abierto. JS plano porque lo importa next.config.mjs.

export const BACKEND_PREFIX = "/backend"

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

// Solo el origen ("https://api.example.com"): con ruta, consulta o credenciales en la
// variable, un error de configuración acabaría reenviando a otro sitio
export function backendOrigin(raw) {
  const value = (raw ?? "").trim()
  if (!value) return null
  const url = new URL(value)
  if (url.protocol !== "https:" && !(url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname))) {
    throw new Error("LARIA_API_ORIGIN debe usar https (http solo en localhost)")
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("LARIA_API_ORIGIN debe ser solo el origen, p. ej. https://api.example.com")
  }
  return url.origin
}

// /backend/health → /health (fuera de /api/v1: es el ping que despierta Render);
// el resto, a /api/v1 con la misma ruta y consulta. :path(.*) conserva la barra
// final ("/chats/"): sin ella, FastAPI redirigiría a su propia URL y el navegador
// dejaría el token por el camino
export function backendRewrites(raw) {
  const origin = backendOrigin(raw)
  if (!origin) return []
  return [
    { source: `${BACKEND_PREFIX}/health`, destination: `${origin}/health` },
    { source: `${BACKEND_PREFIX}/:path(.*)`, destination: `${origin}/api/v1/:path` },
  ]
}
