"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { lariaAPI, ChatMessage } from "@/lib/laria-api"

// Con "reducir movimiento" el texto se muestra tal cual llega, sin efecto de escritura
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}

interface StreamingState {
  isStreaming: boolean
  isThinking: boolean
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
  startStreaming: (content: string, targetChatId?: string) => Promise<void>
  cancelStreaming: () => void
  resetStreaming: () => void
}

export function useStreamingChat({
  messages,
  setMessages,
  chatId,
}: UseStreamingChatOptions): UseStreamingChatReturn {
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    isThinking: false,
    displayedContent: "",
    fullContent: "",
    envelope: null,
    error: null,
    isDone: false,
  })

  const abortControllerRef = useRef<AbortController | null>(null)
  const displayQueueRef = useRef<string[]>([])
  const animationFrameRef = useRef<number | null>(null)
  const lastDisplayTimeRef = useRef<number>(0)
  const pendingContentRef = useRef<string>("")
  const displayedRef = useRef<string>("")
  const baseMessagesRef = useRef<ChatMessage[]>([])
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  const calculateRenderSpeed = useCallback(() => {
    const pending = pendingContentRef.current.length
    const pendingChars = pending

    if (pendingChars < 50) {
      return 30
    } else if (pendingChars < 200) {
      return 16
    } else if (pendingChars < 500) {
      return 8
    } else {
      return 4
    }
  }, [])

  const processDisplayQueue = useCallback(function tick() {
    if (displayQueueRef.current.length === 0) {
      animationFrameRef.current = null
      return
    }

    const now = Date.now()
    const timeSinceLastDisplay = now - lastDisplayTimeRef.current
    const targetInterval = calculateRenderSpeed()

    if (timeSinceLastDisplay < targetInterval) {
      animationFrameRef.current = requestAnimationFrame(tick)
      return
    }

    const chunk = displayQueueRef.current.shift()
    if (chunk) {
      pendingContentRef.current = pendingContentRef.current.slice(chunk.length)

      showAssistantText(displayedRef.current + chunk)
      setState((prev) => ({
        ...prev,
        isThinking: false,
        displayedContent: displayedRef.current,
      }))

      lastDisplayTimeRef.current = now
    }

    if (displayQueueRef.current.length > 0) {
      animationFrameRef.current = requestAnimationFrame(tick)
    } else {
      animationFrameRef.current = null
    }
  }, [calculateRenderSpeed, showAssistantText])

  const queueDisplay = useCallback((content: string) => {
    if (prefersReducedMotion()) {
      showAssistantText(displayedRef.current + content)
      setState((prev) => ({ ...prev, isThinking: false, displayedContent: displayedRef.current }))
      return
    }

    const chunkSize = pendingContentRef.current.length > 200 ? 10 : 
                     pendingContentRef.current.length > 50 ? 5 : 1

    for (let i = 0; i < content.length; i += chunkSize) {
      displayQueueRef.current.push(content.slice(i, i + chunkSize))
    }

    pendingContentRef.current += content

    if (!animationFrameRef.current) {
      lastDisplayTimeRef.current = Date.now()
      animationFrameRef.current = requestAnimationFrame(processDisplayQueue)
    }
  }, [processDisplayQueue, showAssistantText])

  const startStreaming = useCallback(async (content: string, targetChatId?: string) => {
    const activeId = targetChatId || chatId
    if (!activeId) return

    const gen = ++streamGenRef.current
    const isCurrent = () => gen === streamGenRef.current
    streamChatIdRef.current = activeId
    abortControllerRef.current = new AbortController()

    setState({
      isStreaming: true,
      isThinking: true,
      displayedContent: "",
      fullContent: "",
      envelope: null,
      error: null,
      isDone: false,
    })

    displayQueueRef.current = []
    pendingContentRef.current = ""
    displayedRef.current = ""

    const userMsg: ChatMessage = { role: "user", content }
    baseMessagesRef.current = [...messages, userMsg]
    setMessages(baseMessagesRef.current)

    await lariaAPI.chats.stream(activeId, "user", content, {
      onToken: (token: string) => {
        if (!isCurrent()) return
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
        const flushQueue = () => {
          flushTimerRef.current = null
          if (!isCurrent()) return
          stopAnimation()
          const allPending = displayQueueRef.current.join("")
          displayQueueRef.current = []
          pendingContentRef.current = ""
          if (allPending) showAssistantText(displayedRef.current + allPending)

          setState((prev) => ({
            ...prev,
            displayedContent: displayedRef.current,
            isStreaming: false,
            isThinking: false,
            isDone: true,
          }))

          // Después del vaciado, para que la copia local no pise la guardada
          lariaAPI.chats.get(activeId).then((chat) => {
            if (!isCurrent()) return
            streamChatIdRef.current = null
            setMessages(chat.messages || [])
          }).catch(console.error)
        }

        flushTimerRef.current = setTimeout(flushQueue, 100)
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
  }, [chatId, messages, setMessages, queueDisplay, showAssistantText, stopAnimation])

  const cancelStreaming = useCallback(() => {
    streamGenRef.current++
    streamChatIdRef.current = null

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
    stopAnimation()

    displayQueueRef.current = []
    pendingContentRef.current = ""

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
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
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
