import { describe, it, expect, vi, afterEach } from "vitest"
import { useState } from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useStreamingChat } from "./use-streaming-chat"
import type { ChatMessage } from "@/lib/laria-api"
import { controllableSSE, tokenEvent } from "@/test/sse"
import { preferReducedMotion } from "@/test/media"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// Simula el servidor de chats: cada POST /stream abre el siguiente SSE de la lista;
// GET /chats/c1 devuelve el chat guardado.
function stubChatServer(savedMessages: ChatMessage[] = [], streams = 1) {
  const sses = Array.from({ length: streams }, () => controllableSSE())
  let opened = 0
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.endsWith("/stream")) return sses[opened++].fetchMock(url, init)
    return new Response(JSON.stringify({ id: "c1", title: "t", messages: savedMessages }), { status: 200 })
  })
  return sses
}
const network = (savedMessages: ChatMessage[] = []) => stubChatServer(savedMessages)[0]

// Imita al ChatProvider: el chat activo y sus mensajes, que se pueden cambiar
function renderChat(initial: ChatMessage[] = []) {
  return renderHook(() => {
    const [messages, setMessages] = useState<ChatMessage[]>(initial)
    const [chatId, setChatId] = useState("c1")
    const streaming = useStreamingChat({ messages, setMessages, chatId })
    const openChat = (id: string, msgs: ChatMessage[]) => {
      setChatId(id)
      setMessages(msgs)
    }
    return { messages, openChat, ...streaming }
  })
}

const sleep = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)))

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

  it("con «reducir movimiento» muestra cada fragmento tal cual llega, sin efecto de escritura", async () => {
    preferReducedMotion()
    const frames = vi.spyOn(window, "requestAnimationFrame")
    const sse = network()
    const { result } = renderChat()

    act(() => {
      result.current.startStreaming("hola")
    })
    sse.push(tokenEvent("Una respuesta larga que llega de golpe"))

    await waitFor(() => expect(last(result.current.messages).content).toBe("Una respuesta larga que llega de golpe"))
    expect(frames).not.toHaveBeenCalled()
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

  it("cambiar de chat a mitad de respuesta no escribe en el chat nuevo", async () => {
    const sse = network()
    const { result } = renderChat()
    const otherChat: ChatMessage[] = [{ role: "user", content: "Otro tema" }]

    act(() => {
      result.current.startStreaming("hola")
    })
    sse.push(tokenEvent("Hola"))
    await waitFor(() => expect(last(result.current.messages).content).toBe("Hola"))

    act(() => result.current.openChat("c2", otherChat))
    sse.push(tokenEvent(", ¿qué tal?"))
    await sleep(100)

    expect(result.current.messages).toEqual(otherChat)
    expect(sse.signal?.aborted).toBe(true)
  })

  it("parar justo al terminar y volver a enviar no rompe la respuesta nueva", async () => {
    const [first, second] = stubChatServer([], 2)
    const { result } = renderChat()

    act(() => {
      result.current.startStreaming("primera")
    })
    first.push(tokenEvent("Uno"))
    first.push("data: [DONE]\n\n")
    first.close()
    await sleep(20) // ya llegó el [DONE], el vaciado final está pendiente
    act(() => result.current.cancelStreaming())

    act(() => {
      result.current.startStreaming("segunda")
    })
    second.push(tokenEvent("Dos"))
    await sleep(200)

    expect(result.current.isStreaming).toBe(true)
    expect(last(result.current.messages)).toMatchObject({ role: "assistant", content: "Dos" })
  })
})
