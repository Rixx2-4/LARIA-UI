import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"
import { clerkMiddleware } from "@clerk/nextjs/server"

// Las páginas NO pasan por aquí. La app es de cliente: Clerk lleva la sesión en el
// navegador y es el backend quien exige el token, así que ninguna página usa auth()
// en el servidor. Con el middleware en las páginas, cada visita sin cookie de Clerk
// (y con claves de desarrollo, todas) daba tres redirecciones antes de recibir HTML:
// /chat → handshake de Clerk → /chat?__clerk_handshake=… → /chat.
// Queda para rutas de servidor (API), que sí necesitarían auth().
// Sin claves, clerkMiddleware lanza y tumbaría esas rutas: se deja pasar
const configured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY

const clerk = configured ? clerkMiddleware() : null

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!clerk) return NextResponse.next()
  return clerk(request, event)
}

export const config = {
  matcher: ["/(api|trpc)(.*)"],
}
