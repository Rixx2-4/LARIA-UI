"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { lariaAPI, ChatMessage, StreamCallbacks } from "@/lib/laria-api"

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
  const renderSpeedRef = useRef<number>(16)
  const pendingContentRef = useRef<string>("")
  const displayedRef = useRef<string>("")
  const baseMessagesRef = useRef<ChatMessage[]>([])
  const setMessagesRef = useRef(setMessages)
  setMessagesRef.current = setMessages

  // La respuesta en curso vive como último mensaje de la conversación
  const showAssistantText = useCallback((text: string) => {
    displayedRef.current = text
    setMessagesRef.current([...baseMessagesRef.current, { role: "assistant", content: text }])
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

  const processDisplayQueue = useCallback(() => {
    if (displayQueueRef.current.length === 0) {
      animationFrameRef.current = null
      return
    }

    const now = Date.now()
    const timeSinceLastDisplay = now - lastDisplayTimeRef.current
    const targetInterval = calculateRenderSpeed()

    if (timeSinceLastDisplay < targetInterval) {
      animationFrameRef.current = requestAnimationFrame(processDisplayQueue)
      return
    }

    const chunk = displayQueueRef.current.shift()
    if (chunk) {
      pendingContentRef.current = pendingContentRef.current.slice(chunk.length)

      showAssistantText(displayedRef.current + chunk)
      setState((prev) => ({
        ...prev,
        displayedContent: displayedRef.current,
      }))

      lastDisplayTimeRef.current = now
    }

    if (displayQueueRef.current.length > 0) {
      animationFrameRef.current = requestAnimationFrame(processDisplayQueue)
    } else {
      animationFrameRef.current = null
    }
  }, [calculateRenderSpeed, showAssistantText])

  const queueDisplay = useCallback((content: string) => {
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
  }, [processDisplayQueue])

  const startStreaming = useCallback(async (content: string, targetChatId?: string) => {
    const activeId = targetChatId || chatId
    if (!activeId) return

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

    try {
      const signal = abortControllerRef.current.signal
      await lariaAPI.chats.stream(activeId, "user", content, {
        onToken: (token: string) => {
          setState((prev) => ({
            ...prev,
            isThinking: false,
            fullContent: prev.fullContent + token,
          }))
          queueDisplay(token)
        },
        onEnvelope: (envelope: Record<string, unknown>) => {
          setState((prev) => ({
            ...prev,
            envelope,
          }))
        },
        onDone: () => {
          const flushQueue = () => {
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current)
              animationFrameRef.current = null
            }
            const allPending = displayQueueRef.current.join("")
            displayQueueRef.current = []
            pendingContentRef.current = ""
            if (allPending) showAssistantText(displayedRef.current + allPending)

            setState((prev) => ({
              ...prev,
              displayedContent: displayedRef.current,
              isStreaming: false,
              isDone: true,
            }))

            // Después del vaciado, para que la copia local no pise la guardada
            lariaAPI.chats.get(activeId).then((chat) => {
              setMessages(chat.messages || [])
            }).catch(console.error)
          }

          setTimeout(flushQueue, 100)
        },
        onError: (error: Error) => {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            isThinking: false,
            error: error.message,
          }))
        },
      }, { signal })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: error instanceof Error ? error.message : "Error de conexión",
      }))
    }
  }, [chatId, messages, setMessages, queueDisplay, showAssistantText])

  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    displayQueueRef.current = []
    pendingContentRef.current = ""

    setState((prev) => ({
      ...prev,
      isStreaming: false,
      isThinking: false,
      isDone: true,
    }))
  }, [])

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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    ...state,
    startStreaming,
    cancelStreaming,
    resetStreaming,
  }
}
