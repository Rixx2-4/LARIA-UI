import { describe, it, expect } from "vitest"
import { NextRequest, type NextFetchEvent } from "next/server"
import proxy, { config } from "./proxy"

const event = {} as NextFetchEvent
const get = async (path: string, cookie?: string): Promise<Response> => {
  const res = await proxy(new NextRequest(`https://laria.test${path}`, { headers: cookie ? { cookie } : {} }), event)
  if (!res) throw new Error(`proxy no respondió para ${path}`)
  return res
}

describe("proxy: pantallas con sesión", () => {
  it("sin sesión manda a entrar desde el servidor, sin pasar por el handshake de Clerk", async () => {
    const res = await get("/chat")
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("https://laria.test/sign-in?redirect_url=%2Fchat")
  })

  it("con __client_uat a 0 (sesión cerrada) también", async () => {
    const res = await get("/perfil", "__client_uat=0; __client_uat_fHoTIQtm=0")
    expect(res.headers.get("location")).toBe("https://laria.test/sign-in?redirect_url=%2Fperfil")
  })

  it("conserva la consulta para volver al mismo sitio después de entrar", async () => {
    const res = await get("/quiz?chat=abc")
    expect(res.headers.get("location")).toBe("https://laria.test/sign-in?redirect_url=%2Fquiz%3Fchat%3Dabc")
  })

  it("con sesión deja pasar (lo demás lo comprueba Clerk en el navegador)", async () => {
    for (const path of ["/chat/c1", "/clase/p1/prueba-de-paso", "/cuenta/seguridad"]) {
      const res = await get(path, "__client_uat_fHoTIQtm=1792000000")
      expect(res.headers.get("location")).toBeNull()
      expect(res.headers.get("x-middleware-next")).toBe("1")
    }
  })

  it("las páginas públicas no se tocan", async () => {
    for (const path of ["/", "/sign-in", "/sign-up/verify", "/no-existe"]) {
      const res = await get(path)
      expect(res.headers.get("location")).toBeNull()
    }
  })

  it("con sesión, la portada lleva al chat desde el servidor: no se ve ni un instante", async () => {
    const res = await get("/", "__client_uat_fHoTIQtm=1792000000")
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("https://laria.test/chat")
  })

  it("con la sesión cerrada (__client_uat a 0), la portada se ve", async () => {
    const res = await get("/", "__client_uat=0; __client_uat_fHoTIQtm=0")
    expect(res.headers.get("location")).toBeNull()
    expect(res.headers.get("x-middleware-next")).toBe("1")
  })

  it("solo se ejecuta en la portada, las pantallas con sesión y la API", () => {
    expect(config.matcher).toEqual(
      expect.arrayContaining(["/", "/chat/:path*", "/perfil", "/quiz", "/nivelacion", "/cuenta/:path*", "/clases", "/clase/:path*"]),
    )
    expect(config.matcher.some((m) => m.includes("sign-in") || m.includes("legal"))).toBe(false)
  })
})
