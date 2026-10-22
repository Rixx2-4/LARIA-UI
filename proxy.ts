import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"
import { clerkMiddleware } from "@clerk/nextjs/server"
import { NEW_CHAT_HREF, SIGN_IN_HREF } from "@/lib/routes"

// Las pantallas con sesión NO pasan por clerkMiddleware. La app es de cliente: Clerk
// lleva la sesión en el navegador y es el backend quien exige el token, así que
// ninguna página usa auth() en el servidor. Con clerkMiddleware, cada visita sin cookie
// de Clerk (con claves de desarrollo, todas) daba tres redirecciones antes del HTML:
// /chat → handshake de Clerk → /chat?__clerk_handshake=… → /chat.
//
// Lo que sí se hace aquí, sin llamar a nadie: si la cookie de Clerk dice que no hay
// sesión, a entrar desde el servidor. Así no se descarga la app entera (cientos de KB
// de JS) para que el navegador descubra que no hay sesión y redirija él.
// __client_uat la pone Clerk en el dominio de la app: 0 sin sesión, la hora de entrada
// con ella (con sufijo por instancia, p. ej. __client_uat_fHoTIQtm). Si dice que hay
// sesión, se deja pasar y Clerk la valida en el navegador como siempre.
function looksSignedIn(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("__client_uat") && Number(cookie.value) > 0)
}

const PROTECTED = /^\/(chat|perfil|quiz|nivelacion|cuenta|clases|clase)(\/|$)/

// Rutas de servidor (API), que sí necesitarían auth(). Sin claves, clerkMiddleware
// lanza y tumbaría esas rutas: se deja pasar
const configured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY
const clerk = configured ? clerkMiddleware() : null

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname, search } = request.nextUrl

  // Con sesión, la portada lleva directamente al chat desde el servidor. Redirigir en el
  // navegador (landing-header.tsx, que se queda de respaldo) dejaba ver la portada un
  // instante. Sin sesión, la portada se sirve como siempre (estática, sin Clerk)
  if (pathname === "/") {
    return looksSignedIn(request) ? NextResponse.redirect(new URL(NEW_CHAT_HREF, request.url), 307) : NextResponse.next()
  }

  if (PROTECTED.test(pathname)) {
    if (looksSignedIn(request)) return NextResponse.next()
    const signIn = new URL(SIGN_IN_HREF, request.url)
    signIn.searchParams.set("redirect_url", pathname + search)
    return NextResponse.redirect(signIn, 307)
  }

  if (clerk && /^\/(api|trpc)(\/|$)/.test(pathname)) return clerk(request, event)
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/",
    "/chat/:path*",
    "/perfil",
    "/quiz",
    "/nivelacion",
    "/cuenta/:path*",
    "/clases",
    "/clase/:path*",
    "/(api|trpc)(.*)",
  ],
}
