import { describe, it, expect, vi, afterEach } from "vitest"
import { lariaAPI } from "./laria-api"
import { controllableSSE, tokenEvent } from "@/test/sse"

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
})
