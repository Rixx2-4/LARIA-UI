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
  // Resuelve con la respuesta completa, o null si se cortó, falló o se cambió de chat
  startStreaming: (content: string, targetChatId?: string) => Promise<string | null>
  stopStreaming: () => void
  cancelStreaming: () => void
  resetStreaming: () => void
}

// Ritmo de escritura, por tiempo (igual a 60 que a 120 Hz): nunca más lento que
// MIN_CPS, alcanza lo pendiente en unos CATCH_UP_MS y nunca más rápido que MAX_CPS.
// Así una respuesta que el servidor manda de golpe también aparece poco a poco
const MIN_CPS = 150
const MAX_CPS = 600
const CATCH_UP_MS = 1500

const IDLE_STATE: StreamingState = {
  isStreaming: false,
  isThinking: false,
  thinkingLabel: "",
  displayedContent: "",
  fullContent: "",
  envelope: null,
  error: null,
  isDone: false,
}

// Sin efecto de escritura con la pestaña oculta (el navegador pausa los fotogramas)
// o con "reducir movimiento": el texto se muestra tal cual llega
function shouldAnimate(): boolean {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false
  return !(typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
}

export function useStreamingChat({
  messages,
  setMessages,
  chatId,
}: UseStreamingChatOptions): UseStreamingChatReturn {
  const [state, setState] = useState<StreamingState>(IDLE_STATE)

  const abortControllerRef = useRef<AbortController | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastTickRef = useRef(0)
  // Todo lo recibido del servidor y la parte que ya se ve en pantalla
  const receivedRef = useRef<string>("")
  const displayedRef = useRef<string>("")
  // El servidor ya terminó: al acabar de mostrarse, se cierra la respuesta
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

  const showUpTo = useCallback((end: number) => {
    const received = receivedRef.current
    // Un emoji (par sustituto) no se parte por la mitad
    const code = received.charCodeAt(end - 1)
    if (code >= 0xd800 && code <= 0xdbff && end < received.length) end++
    showAssistantText(received.slice(0, end))
    setState((prev) => ({ ...prev, isThinking: false, displayedContent: displayedRef.current }))
  }, [showAssistantText])

  // Muestra ya todo lo recibido y, si el servidor terminó, cierra la respuesta
  const revealAll = useCallback(() => {
    stopAnimation()
    if (receivedRef.current.length > displayedRef.current.length) showUpTo(receivedRef.current.length)
    finishRef.current?.()
  }, [showUpTo, stopAnimation])

  // Efecto de escritura: cada fotograma muestra un poco más, más cuanto más texto
  // queda pendiente, para no quedarse muy atrás de lo que manda el servidor
  const revealTick = useCallback(function tick(now: number) {
    if (!shouldAnimate()) return revealAll()
    const elapsed = Math.min(now - lastTickRef.current, 100)
    lastTickRef.current = now
    const shown = displayedRef.current.length
    const backlog = receivedRef.current.length - shown

    if (backlog > 0) {
      const speed = Math.min(MAX_CPS, Math.max(MIN_CPS, (backlog * 1000) / CATCH_UP_MS))
      showUpTo(shown + Math.max(1, Math.round((speed * elapsed) / 1000)))
    }

    if (receivedRef.current.length > displayedRef.current.length) {
      animationFrameRef.current = requestAnimationFrame(tick)
    } else {
      animationFrameRef.current = null
      finishRef.current?.()
    }
  }, [revealAll, showUpTo])

  const queueDisplay = useCallback((content: string) => {
    receivedRef.current += content
    if (!shouldAnimate()) return revealAll()
    if (!animationFrameRef.current) {
      lastTickRef.current = performance.now()
      animationFrameRef.current = requestAnimationFrame(revealTick)
    }
  }, [revealAll, revealTick])

  // Si la pestaña pasa a segundo plano a mitad de respuesta, se muestra ya entera
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && animationFrameRef.current) revealAll()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [revealAll])

  const startStreaming = useCallback(async (content: string, targetChatId?: string) => {
    const activeId = targetChatId || chatId
    if (!activeId) return null
    let reply = ""
    let completed = false

    const gen = ++streamGenRef.current
    const isCurrent = () => gen === streamGenRef.current
    streamChatIdRef.current = activeId
    abortControllerRef.current = new AbortController()

    setState({ ...IDLE_STATE, isStreaming: true, isThinking: true })

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
        // Si no queda nada por escribir se cierra ya; si no, al acabar la animación
        if (!animationFrameRef.current) finishRef.current()
      },
      onError: (error: Error) => {
        if (!isCurrent()) return
        // Lo que ya llegó se queda a la vista junto al error
        stopAnimation()
        if (receivedRef.current.length > displayedRef.current.length) showUpTo(receivedRef.current.length)
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          isThinking: false,
          error: error.message,
        }))
      },
    }, { signal: abortControllerRef.current.signal })
    return completed && isCurrent() ? reply : null
  }, [chatId, messages, setMessages, queueDisplay, showUpTo, stopAnimation])

  // Corta en seco: se descarta todo lo que siga llegando (cambio de chat, envío nuevo)
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

  // El botón "Parar": si el servidor ya lo mandó todo y solo quedaba escribirla,
  // parar es saltarse la animación (se ve entera, que es la que quedó guardada)
  const stopStreaming = useCallback(() => {
    if (finishRef.current) revealAll()
    else cancelStreaming()
  }, [revealAll, cancelStreaming])

  // Cambiar de chat corta la respuesta del anterior para que no escriba en el nuevo
  useEffect(() => {
    if (streamChatIdRef.current && chatId !== streamChatIdRef.current) {
      cancelStreaming()
    }
  }, [chatId, cancelStreaming])

  const resetStreaming = useCallback(() => {
    cancelStreaming()
    setState(IDLE_STATE)
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
    stopStreaming,
    cancelStreaming,
    resetStreaming,
  }
}
