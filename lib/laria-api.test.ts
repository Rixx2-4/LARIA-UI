import { describe, it, expect, vi, afterEach } from "vitest"
import { lariaAPI, getAuthToken, onUnauthorized, setAuthToken, describeErrorDetail } from "./laria-api"
import { controllableSSE, doneEvent, errorEvent, tokenEvent } from "@/test/sse"

afterEach(() => {
  vi.unstubAllGlobals()
})

function recorder() {
  const events: string[] = []
  return {
    events,
    callbacks: {
      onToken: (t: string) => events.push(`token:${t}`),
      onEnvelope: (e: Record<string, unknown>) => events.push(`envelope:${e.type}`),
      onDone: () => events.push("done"),
      onError: (e: Error) => events.push(`error:${e.message}`),
    },
  }
}

describe("lariaAPI.chats.stream", () => {
  it("entiende el formato del backend: thinking → token(n) → envelope → done", async () => {
    const sse = controllableSSE()
    vi.stubGlobal("fetch", sse.fetchMock)
    const { events, callbacks } = recorder()

    const done = lariaAPI.chats.stream("c1", "user", "hola", callbacks)
    sse.push("event: thinking\ndata: {}\n\n")
    sse.push(tokenEvent("Hola"))
    sse.push(tokenEvent(" mundo"))
    sse.push('event: envelope\ndata: {"type": "answer", "payload": {"content": "Hola mundo"}}\n\n')
    sse.push(doneEvent())
    await done

    expect(events).toEqual(["token:Hola", "token: mundo", "envelope:answer", "done"])
  })

  it("un evento de error del tutor llega como error con su texto, no como respuesta vacía", async () => {
    const sse = controllableSSE()
    vi.stubGlobal("fetch", sse.fetchMock)
    const { events, callbacks } = recorder()

    const done = lariaAPI.chats.stream("c1", "user", "hola", callbacks)
    sse.push(tokenEvent("Hol"))
    sse.push(errorEvent("No pude generar la respuesta. Intenta de nuevo."))
    await done

    expect(events).toEqual(["token:Hol", "error:No pude generar la respuesta. Intenta de nuevo."])
  })

  it("termina con [DONE] aunque el servidor use saltos de línea CRLF", async () => {
    const sse = controllableSSE()
    vi.stubGlobal("fetch", sse.fetchMock)
    const { events, callbacks } = recorder()

    const done = lariaAPI.chats.stream("c1", "user", "hola", callbacks)
    sse.push('data: {"type":"token","content":"Hola"}\r\n\r\n')
    sse.push("data: [DONE]\r\n\r\n")
    sse.close()
    await done

    expect(events).toEqual(["token:Hola", "done"])
  })

  it("reconstruye un evento partido entre dos fragmentos de red", async () => {
    const sse = controllableSSE()
    vi.stubGlobal("fetch", sse.fetchMock)
    const { events, callbacks } = recorder()

    const done = lariaAPI.chats.stream("c1", "user", "hola", callbacks)
    sse.push('data: {"type":"token","con')
    sse.push('tent":"Fotosíntesis"}\n\n')
    sse.push("data: [DONE]\n\n")
    sse.close()
    await done

    expect(events).toEqual(["token:Fotosíntesis", "done"])
  })

  it("al abortar se detiene sin emitir done ni error", async () => {
    const sse = controllableSSE()
    vi.stubGlobal("fetch", sse.fetchMock)
    const { events, callbacks } = recorder()
    const abort = new AbortController()

    const done = lariaAPI.chats.stream("c1", "user", "hola", callbacks, { signal: abort.signal })
    sse.push(tokenEvent("Hola"))
    await vi.waitFor(() => expect(events).toEqual(["token:Hola"]))
    abort.abort()
    await done

    expect(events).toEqual(["token:Hola"])
  }, 1000)

  it("si la conexión se corta a mitad, lo avisa por onError", async () => {
    const sse = controllableSSE()
    vi.stubGlobal("fetch", sse.fetchMock)
    const { events, callbacks } = recorder()

    const done = lariaAPI.chats.stream("c1", "user", "hola", callbacks)
    sse.push(tokenEvent("Hola"))
    await vi.waitFor(() => expect(events).toEqual(["token:Hola"]))
    sse.fail(new TypeError("network error"))
    await done

    expect(events).toEqual(["token:Hola", "error:Se perdió la conexión con LARIA"])
  })

  it("si el servidor rechaza la petición, avisa con su mensaje", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ detail: "Chat no encontrado" }), { status: 404 }),
    )
    const { events, callbacks } = recorder()

    await lariaAPI.chats.stream("c1", "user", "hola", callbacks)

    expect(events).toEqual(["error:Chat no encontrado"])
  })

  it("no pierde el último evento si el stream se cierra sin salto de línea", async () => {
    const sse = controllableSSE()
    vi.stubGlobal("fetch", sse.fetchMock)
    const { events, callbacks } = recorder()

    const done = lariaAPI.chats.stream("c1", "user", "hola", callbacks)
    sse.push('data: {"type":"token","content":"fin"}')
    sse.close()
    await done

    expect(events).toEqual(["token:fin", "done"])
  })
})

describe("sesión caducada", () => {
  afterEach(() => setAuthToken(null))

  it("un 401 en cualquier petición borra el token y avisa", async () => {
    setAuthToken("caducado")
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ detail: "Token inválido o expirado" }), { status: 401 }),
    )
    const listener = vi.fn()
    const unsubscribe = onUnauthorized(listener)

    await expect(lariaAPI.chats.list()).rejects.toThrow("Token inválido o expirado")

    expect(getAuthToken()).toBeNull()
    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
  })

  it("un 401 tardío de la sesión anterior no cierra una sesión nueva", async () => {
    setAuthToken("viejo")
    let answer!: (r: Response) => void
    vi.stubGlobal("fetch", () => new Promise<Response>((r) => (answer = r)))
    const listener = vi.fn()
    const unsubscribe = onUnauthorized(listener)

    const oldRequest = lariaAPI.chats.list().catch(() => {})
    setAuthToken("nuevo") // el usuario vuelve a iniciar sesión mientras tanto
    answer(new Response("{}", { status: 401 }))
    await oldRequest

    expect(getAuthToken()).toBe("nuevo")
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it.each([
    ["el stream del chat", () => lariaAPI.chats.stream("c1", "user", "hola", { onError: () => {} })],
    ["la subida de un archivo", () => lariaAPI.documents.upload(new File(["x"], "apuntes.txt")).catch(() => {})],
  ])("%s también cierra la sesión con un 401", async (_name, call) => {
    setAuthToken("caducado")
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 401 }))
    const listener = vi.fn()
    const unsubscribe = onUnauthorized(listener)

    await call()

    expect(getAuthToken()).toBeNull()
    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
  })
})

describe("lariaAPI.documents.content", () => {
  afterEach(() => setAuthToken(null))

  it("descarga el archivo autenticando por cabecera, nunca por la URL", async () => {
    setAuthToken("secreto")
    let requested: { url: string; auth: string | null } | null = null
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      requested = { url, auth: new Headers(init?.headers).get("Authorization") }
      return new Response("%PDF-1.7", { status: 200, headers: { "Content-Type": "application/pdf" } })
    })

    const blob = await lariaAPI.documents.content("d1")

    expect(await blob.text()).toBe("%PDF-1.7")
    expect(blob.type).toBe("application/pdf")
    expect(requested).toEqual({
      url: expect.stringMatching(/\/documents\/d1\/content$/),
      auth: "Bearer secreto",
    })
  })
})

describe("lariaAPI.auth.login", () => {
  it("con credenciales incorrectas avisa en español y no cierra ninguna sesión", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ detail: "Incorrect username or password" }), { status: 401 }))
    const listener = vi.fn()
    const unsubscribe = onUnauthorized(listener)

    await expect(lariaAPI.auth.login("ana@example.com", "mal")).rejects.toThrow("Email o contraseña incorrectos")
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })
})

describe("errores de validación del backend", () => {
  it("un 422 con la lista de FastAPI se cuenta en español, no como [object Object]", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(
        JSON.stringify({
          detail: [{ type: "string_too_short", loc: ["body", "password"], msg: "String should have at least 12 characters", ctx: { min_length: 12 } }],
        }),
        { status: 422 },
      ),
    )

    await expect(lariaAPI.auth.register("ana", "ana@example.com", "Abcdef12")).rejects.toThrow(
      "La contraseña debe tener al menos 12 caracteres.",
    )
  })

  it("junta varios errores y deja pasar los textos que ya vienen en español", () => {
    expect(
      describeErrorDetail(
        [
          { type: "missing", loc: ["body", "username"], msg: "Field required" },
          { type: "value_error", loc: ["body", "email"], msg: "value is not a valid email address: An email address must have an @-sign." },
        ],
        "fallo",
      ),
    ).toBe("El nombre de usuario es obligatorio. El email no es válido.")
    expect(describeErrorDetail("La contraseña es demasiado débil", "fallo")).toBe("La contraseña es demasiado débil")
    expect(describeErrorDetail(undefined, "fallo")).toBe("fallo")
  })
})

describe("peticiones a la API", () => {
  it("un id manipulado queda dentro de su tramo de la ruta", async () => {
    const urls: string[] = []
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url)
      return new Response(JSON.stringify({ id: "x", title: "t", messages: [] }), { status: 200 })
    })

    await lariaAPI.chats.get("../users/me")

    expect(urls[0]).toMatch(/\/chats\/\.\.%2Fusers%2Fme$/)
  })

  it("solo las peticiones con cuerpo JSON llevan Content-Type (los GET no piden permiso de CORS)", async () => {
    const seen: (string | undefined)[] = []
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      seen.push((init?.headers as Record<string, string>)["Content-Type"])
      return new Response(JSON.stringify({ chats: [] }), { status: 200 })
    })

    await lariaAPI.chats.list()
    await lariaAPI.chats.create("Nuevo")

    expect(seen).toEqual([undefined, "application/json"])
  })
})
