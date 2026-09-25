// Simula la red: un fetch que devuelve un cuerpo SSE cuyos fragmentos
// empuja el test cuando quiere, y que respeta el AbortSignal.
export function controllableSSE() {
  const encoder = new TextEncoder()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  let signal: AbortSignal | undefined

  const fetchMock = async (_url: string, init?: RequestInit) => {
    signal = init?.signal ?? undefined
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
    signal?.addEventListener("abort", () => {
      try {
        controller.error(new DOMException("Aborted", "AbortError"))
      } catch {}
    })
    return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })
  }

  return {
    fetchMock,
    // Si el cliente ya cortó, lo que siga mandando el servidor se pierde
    push: (text: string) => {
      if (signal?.aborted) return
      controller.enqueue(encoder.encode(text))
    },
    close: () => controller.close(),
    fail: (err: Error) => controller.error(err),
    get signal() {
      return signal
    },
  }
}

// Eventos con el formato del backend: "event: <nombre>" y "data: <json>"
const sseEvent = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`

export const tokenEvent = (content: string) => sseEvent("token", { content })
export const doneEvent = () => sseEvent("done", { message_id: "m1" })
export const errorEvent = (content: string) =>
  sseEvent("error", { type: "error", payload: { content, grounded: false } })
