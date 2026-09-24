"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { lariaAPI, ChatMessage } from "@/lib/laria-api"

interface StreamingState {
  isStreaming: boolean
  isThinking: boolean
  // Lo que el tutor dice que está haciendo mientras piensa ("" si no dice nada)
  thinkingLabel: string
  displayedContent: string
  fullContent: string
  envelope: Record<string, unknown> | null
  error: string | null
  isDone: boolean
}

interface UseStreamingChatOptions {
  messages: ChatMessage[]
  setMessages: (msgs: ChatMessage[]) => void
  chatId: string | null
}

interface UseStreamingChatReturn extends StreamingState {
  // Resuelve con la respuesta completa, o null si se paró, falló o se cambió de chat
  startStreaming: (content: string, targetChatId?: string) => Promise<string | null>
  cancelStreaming: () => void
  resetStreaming: () => void
}

// Ritmo de escritura: mínimo por fotograma y en cuántos fotogramas (~60/s) se
// alcanzaría lo pendiente si no llegara nada más
const MIN_CHARS_PER_FRAME = 2
const CATCH_UP_FRAMES = 30

export function useStreamingChat({
  messages,
  setMessages,
  chatId,
}: UseStreamingChatOptions): UseStreamingChatReturn {
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    isThinking: false,
    thinkingLabel: "",
    displayedContent: "",
    fullContent: "",
    envelope: null,
    error: null,
    isDone: false,
  })

  const abortControllerRef = useRef<AbortController | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  // Todo lo recibido del servidor y la parte que ya se ve en pantalla
  const receivedRef = useRef<string>("")
  const displayedRef = useRef<string>("")
  // El servidor ya terminó; al acabar de mostrarse se cierra la respuesta
  const finishRef = useRef<(() => void) | null>(null)
  const baseMessagesRef = useRef<ChatMessage[]>([])
  // Cada stream tiene su generación: lo que llegue de uno anterior se descarta
  const streamGenRef = useRef(0)
  const streamChatIdRef = useRef<string | null>(null)

  // La respuesta en curso vive como último mensaje de la conversación
  const showAssistantText = useCallback((text: string) => {
    displayedRef.current = text
    setMessages([...baseMessagesRef.current, { role: "assistant", content: text }])
  }, [setMessages])

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  // Efecto de escritura: en cada fotograma se muestra un poco más, más cuanto más
  // texto queda pendiente, para no quedarse atrás aunque el servidor mande todo de golpe
  const revealTick = useCallback(function tick() {
    const received = receivedRef.current
    const shown = displayedRef.current.length
    const backlog = received.length - shown

    if (backlog > 0) {
      let end = shown + Math.max(MIN_CHARS_PER_FRAME, Math.ceil(backlog / CATCH_UP_FRAMES))
      // No partir un emoji (par sustituto) por la mitad
      const code = received.charCodeAt(end - 1)
      if (code >= 0xd800 && code <= 0xdbff) end++
      showAssistantText(received.slice(0, end))
      setState((prev) => ({ ...prev, isThinking: false, displayedContent: displayedRef.current }))
    }

    if (receivedRef.current.length > displayedRef.current.length) {
      animationFrameRef.current = requestAnimationFrame(tick)
    } else {
      animationFrameRef.current = null
      finishRef.current?.()
    }
  }, [showAssistantText])

  const queueDisplay = useCallback((content: string) => {
    receivedRef.current += content
    if (!animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(revealTick)
    }
  }, [revealTick])

  const startStreaming = useCallback(async (content: string, targetChatId?: string) => {
    const activeId = targetChatId || chatId
    if (!activeId) return null
    let reply = ""
    let completed = false

    const gen = ++streamGenRef.current
    const isCurrent = () => gen === streamGenRef.current
    streamChatIdRef.current = activeId
    abortControllerRef.current = new AbortController()

    setState({
      isStreaming: true,
      isThinking: true,
      thinkingLabel: "",
      displayedContent: "",
      fullContent: "",
      envelope: null,
      error: null,
      isDone: false,
    })

    receivedRef.current = ""
    displayedRef.current = ""
    finishRef.current = null

    const userMsg: ChatMessage = { role: "user", content }
    baseMessagesRef.current = [...messages, userMsg]
    setMessages(baseMessagesRef.current)

    await lariaAPI.chats.stream(activeId, "user", content, {
      onThinking: (label: string) => {
        if (!isCurrent()) return
        setState((prev) => ({ ...prev, thinkingLabel: label }))
      },
      onToken: (token: string) => {
        if (!isCurrent()) return
        reply += token
        setState((prev) => ({
          ...prev,
          fullContent: prev.fullContent + token,
        }))
        queueDisplay(token)
      },
      onEnvelope: (envelope: Record<string, unknown>) => {
        if (!isCurrent()) return
        setState((prev) => ({
          ...prev,
          envelope,
        }))
      },
      onDone: () => {
        if (!isCurrent()) return
        completed = true
        finishRef.current = () => {
          finishRef.current = null
          if (!isCurrent()) return
          setState((prev) => ({
            ...prev,
            displayedContent: displayedRef.current,
            isStreaming: false,
            isThinking: false,
            isDone: true,
          }))

          // Ya se ve entera: ahora sí se trae la versión guardada (con sus metadatos)
          lariaAPI.chats.get(activeId).then((chat) => {
            if (!isCurrent()) return
            streamChatIdRef.current = null
            setMessages(chat.messages || [])
          }).catch(console.error)
        }
        // Si no queda nada por mostrar se cierra ya; si no, lo hará la animación al acabar
        if (!animationFrameRef.current) finishRef.current()
      },
      onError: (error: Error) => {
        if (!isCurrent()) return
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          isThinking: false,
          error: error.message,
        }))
      },
    }, { signal: abortControllerRef.current.signal })
    return completed && isCurrent() ? reply : null
  }, [chatId, messages, setMessages, queueDisplay])

  const cancelStreaming = useCallback(() => {
    streamGenRef.current++
    streamChatIdRef.current = null

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    stopAnimation()
    finishRef.current = null
    receivedRef.current = displayedRef.current

    setState((prev) => ({
      ...prev,
      isStreaming: false,
      isThinking: false,
      isDone: true,
    }))
  }, [stopAnimation])

  // Cambiar de chat corta la respuesta del anterior para que no escriba en el nuevo
  useEffect(() => {
    if (streamChatIdRef.current && chatId !== streamChatIdRef.current) {
      cancelStreaming()
    }
  }, [chatId, cancelStreaming])

  const resetStreaming = useCallback(() => {
    cancelStreaming()
    setState({
      isStreaming: false,
      isThinking: false,
      thinkingLabel: "",
      displayedContent: "",
      fullContent: "",
      envelope: null,
      error: null,
      isDone: false,
    })
  }, [cancelStreaming])

  useEffect(() => {
    return () => {
      // Es un contador, no un nodo del DOM: se quiere justo el valor actual
      // eslint-disable-next-line react-hooks/exhaustive-deps
      streamGenRef.current++
      stopAnimation()
      abortControllerRef.current?.abort()
    }
  }, [stopAnimation])

  return {
    ...state,
    startStreaming,
    cancelStreaming,
    resetStreaming,
  }
}
