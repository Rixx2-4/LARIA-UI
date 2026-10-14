// Clerk solo funciona con sus claves. Sin ellas (p. ej. un despliegue sin configurar)
// la app no debe caerse entera: se ve sin sesión y las pantallas de cuenta lo explican
export const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ""
export const clerkConfigured = clerkPublishableKey.length > 0

// El dominio de Clerk (su "Frontend API") va codificado en la clave publicable:
// pk_<entorno>_<base64("dominio$")>. Sirve para abrir la conexión con Clerk en cuanto
// llega el HTML, antes de que el JS lo pida. Si no se entiende, sin preconnect
export function frontendApiFromKey(key: string): string | null {
  try {
    const decoded = atob(key.split("_")[2] ?? "")
    if (!decoded.endsWith("$")) return null
    const host = decoded.slice(0, -1)
    return /^[a-z0-9.-]+$/i.test(host) ? host : null
  } catch {
    return null
  }
}

export const clerkFrontendApi = frontendApiFromKey(clerkPublishableKey)
