import { NextResponse } from "next/server"
import { clerkMiddleware } from "@clerk/nextjs/server"

// Clerk necesita ver cada petición para su sesión (cookies). Las rutas no se
// protegen aquí: la app es de cliente y es el backend quien exige el token.
// Sin claves, clerkMiddleware lanza y tumbaría TODAS las páginas: se deja pasar
const configured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY

export default configured ? clerkMiddleware() : () => NextResponse.next()

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
}
