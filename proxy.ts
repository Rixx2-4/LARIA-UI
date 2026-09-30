import { clerkMiddleware } from "@clerk/nextjs/server"

// Clerk necesita ver cada petición para su sesión (cookies). Las rutas no se
// protegen aquí: la app es de cliente y es el backend quien exige el token
export default clerkMiddleware()

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
}
