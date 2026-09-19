"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { lariaAPI, ChatMessage, StreamCallbacks } from "@/lib/laria-api"

interface StreamingState {
  isStreaming: boolean
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
  startStreaming: (content: string) => Promise<void>
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

      setState((prev) => ({
        ...prev,
        displayedContent: prev.displayedContent + chunk,
      }))

      lastDisplayTimeRef.current = now
    }

    if (displayQueueRef.current.length > 0) {
      animationFrameRef.current = requestAnimationFrame(processDisplayQueue)
    } else {
      animationFrameRef.current = null
    }
  }, [calculateRenderSpeed])

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
      displayedContent: "",
      fullContent: "",
      envelope: null,
      error: null,
      isDone: false,
    })

    displayQueueRef.current = []
    pendingContentRef.current = ""

    const userMsg: ChatMessage = { role: "user", content }
    setMessages([...messages, userMsg])

    try {
      await lariaAPI.chats.stream(activeId, "user", content, {
        onToken: (token: string) => {
          setState((prev) => ({
            ...prev,
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
            if (displayQueueRef.current.length > 0) {
              const allPending = displayQueueRef.current.join("")
              displayQueueRef.current = []
              pendingContentRef.current = ""

              setState((prev) => ({
                ...prev,
                displayedContent: prev.displayedContent + allPending,
                isStreaming: false,
                isDone: true,
              }))
            } else {
              setState((prev) => ({
                ...prev,
                isStreaming: false,
                isDone: true,
              }))
            }
          }

          setTimeout(flushQueue, 100)

          lariaAPI.chats.get(activeId).then((chat) => {
            setMessages(chat.messages || [])
          }).catch(console.error)
        },
        onError: (error: Error) => {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: error.message,
          }))
        },
      })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: error instanceof Error ? error.message : "Error de conexión",
      }))
    }
  }, [chatId, messages, setMessages, queueDisplay])

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
      isDone: true,
    }))
  }, [])

  const resetStreaming = useCallback(() => {
    cancelStreaming()
    setState({
      isStreaming: false,
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
