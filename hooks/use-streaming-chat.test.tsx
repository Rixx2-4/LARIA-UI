import { describe, it, expect, vi, afterEach } from "vitest"
import { useState } from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useStreamingChat } from "./use-streaming-chat"
import type { ChatMessage } from "@/lib/laria-api"
import { controllableSSE, tokenEvent } from "@/test/sse"

afterEach(() => {
  vi.unstubAllGlobals()
})

// La red: POST /chats/c1/stream responde SSE; GET /chats/c1 devuelve el chat guardado.
function network(savedMessages: ChatMessage[] = []) {
  const sse = controllableSSE()
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.endsWith("/stream")) return sse.fetchMock(url, init)
    return new Response(JSON.stringify({ id: "c1", title: "t", messages: savedMessages }), { status: 200 })
  })
  return sse
}

function renderChat(initial: ChatMessage[] = []) {
  return renderHook(() => {
    const [messages, setMessages] = useState<ChatMessage[]>(initial)
    const streaming = useStreamingChat({ messages, setMessages, chatId: "c1" })
    return { messages, ...streaming }
  })
}

const last = (msgs: ChatMessage[]) => msgs[msgs.length - 1]

describe("useStreamingChat", () => {
  it("muestra la respuesta del asistente creciendo mientras llega", async () => {
    const sse = network()
    const { result } = renderChat()

    act(() => {
      result.current.startStreaming("¿Qué es la fotosíntesis?")
    })
    sse.push(tokenEvent("La foto"))
    await waitFor(() =>
      expect(last(result.current.messages)).toMatchObject({ role: "assistant", content: "La foto" }),
    )
    sse.push(tokenEvent("síntesis"))
    await waitFor(() =>
      expect(last(result.current.messages)).toMatchObject({ role: "assistant", content: "La fotosíntesis" }),
    )
    expect(result.current.messages[0]).toMatchObject({ role: "user", content: "¿Qué es la fotosíntesis?" })
    expect(result.current.isStreaming).toBe(true)
  })

  it("parar corta la conexión y deja lo que ya se había escrito", async () => {
    const sse = network()
    const { result } = renderChat()

    act(() => {
      result.current.startStreaming("hola")
    })
    sse.push(tokenEvent("Hola, soy"))
    await waitFor(() => expect(last(result.current.messages).content).toBe("Hola, soy"))

    act(() => result.current.cancelStreaming())

    expect(sse.signal?.aborted).toBe(true)
    expect(result.current.isStreaming).toBe(false)
    expect(last(result.current.messages)).toMatchObject({ role: "assistant", content: "Hola, soy" })
  })

  it("si la conexión se cae, muestra el error y conserva el texto parcial", async () => {
    const sse = network()
    const { result } = renderChat()

    act(() => {
      result.current.startStreaming("hola")
    })
    sse.push(tokenEvent("Hola"))
    await waitFor(() => expect(last(result.current.messages).content).toBe("Hola"))
    sse.fail(new TypeError("network error"))

    await waitFor(() => expect(result.current.error).toBe("Se perdió la conexión con LARIA"))
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.isThinking).toBe(false)
    expect(last(result.current.messages)).toMatchObject({ role: "assistant", content: "Hola" })
  })

  it("al terminar queda la versión guardada en el servidor, con sus metadatos", async () => {
    const answer = "La fotosíntesis convierte luz en energía química. ".repeat(12)
    const saved: ChatMessage[] = [
      { role: "user", content: "¿Qué es la fotosíntesis?" },
      { role: "assistant", content: answer, metadata: { envelope: { type: "explanation" } } },
    ]
    const sse = network(saved)
    const { result } = renderChat()

    act(() => {
      result.current.startStreaming("¿Qué es la fotosíntesis?")
    })
    sse.push(tokenEvent(answer))
    sse.push("data: [DONE]\n\n")
    sse.close()

    await waitFor(() => expect(result.current.isDone).toBe(true))
    await act(() => new Promise((r) => setTimeout(r, 200)))
    expect(result.current.messages).toEqual(saved)
  })
})
