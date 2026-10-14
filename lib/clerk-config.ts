// Clerk solo funciona con sus claves. Sin ellas (p. ej. un despliegue sin configurar)
// la app no debe caerse entera: se ve sin sesión y las pantallas de cuenta lo explican
export const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ""
export const clerkConfigured = clerkPublishableKey.length > 0
