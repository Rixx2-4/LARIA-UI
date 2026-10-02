"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ApiError, lariaAPI, type SpeechEmotion } from "@/lib/laria-api"
import { takeSpeakable } from "@/lib/speech-chunks"

// La voz del tutor: una cola de frases que se piden a /speech y suenan en orden.
// Mientras suena una se pide la siguiente (una sola petición en vuelo), y lo ya
// dicho se guarda en memoria para volver a escucharlo sin pagarlo dos veces.

export type SpeechMode = "voice" | "text"

const MODE_KEY = "laria_voz"
const EMOTIONS: SpeechEmotion[] = ["calm", "encouraging", "patient", "celebratory"]
const CACHE_LIMIT = 200
// WAV vacío: sonarlo al pulsar desbloquea el audio en Safari para lo que llegue luego
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA="

export function toEmotion(value: unknown): SpeechEmotion {
  return EMOTIONS.includes(value as SpeechEmotion) ? (value as SpeechEmotion) : "encouraging"
}

function readMode(): SpeechMode {
  try {
    return localStorage.getItem(MODE_KEY) === "voice" ? "voice" : "text"
  } catch {
    return "text"
  }
}

interface QueueItem {
  text: string
  emotion: SpeechEmotion
  // De qué mensaje es: para marcar su botón como «Detener» mientras suena
  key: string
  // Qué trozo es dentro de lo que se mandó a leer (la pizarra lo sigue)
  index: number
  status: "waiting" | "fetching" | "ready"
  audio?: Blob | null
}

export function useSpeech() {
  const [enabled, setEnabled] = useState(false)
  // Ya se sabe si hay voz (la consulta nunca falla: sin voz, enabled = false)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [maxChars, setMaxChars] = useState(1200)
  // Por defecto solo texto: cada audio cuesta dinero
  const [mode, setModeState] = useState<SpeechMode>("text")
  // Qué está sonando ahora: el mensaje y el trozo
  const [speaking, setSpeaking] = useState<{ key: string; index: number } | null>(null)
  // De qué mensaje queda algo por leer (pedido, en camino o sonando); null al acabar,
  // al detenerse o si falla: así quien sigue la lectura sabe que terminó
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const queueRef = useRef<QueueItem[]>([])
  const playingRef = useRef(false)
  const generationRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const cacheRef = useRef(new Map<string, Blob | null>())
  // Para mover la boca de la mascota con el volumen real de lo que suena
  const analyserRef = useRef<AnalyserNode | null>(null)
  const levelBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  useEffect(() => {
    // localStorage solo existe en el cliente: se lee al montar
    setModeState(readMode())
    let cancelled = false
    lariaAPI.speech.config().then((config) => {
      if (cancelled) return
      setEnabled(config.enabled)
      setMaxChars(config.max_chars)
      setConfigLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const audio = useCallback(() => {
    audioRef.current ??= new Audio()
    return audioRef.current
  }, [])

  const releaseUrl = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
  }

  const stop = useCallback(() => {
    generationRef.current++
    abortRef.current?.abort()
    abortRef.current = null
    queueRef.current = []
    playingRef.current = false
    audioRef.current?.pause()
    releaseUrl()
    setSpeaking(null)
    setPendingKey(null)
  }, [])

  // El audio pasa por un analizador de Web Audio. Ojo: una vez conectado, el sonido
  // SOLO sale por ese contexto; si estuviera suspendido, LARIA se quedaría muda. Por
  // eso se conecta únicamente cuando el contexto ya está en marcha; si no, no hay
  // analizador y la boca usa su animación en bucle
  const connectAnalyser = useCallback((element: HTMLAudioElement) => {
    if (element.dataset.analyser) return
    const Context = typeof window !== "undefined" ? window.AudioContext : undefined
    if (!Context) return
    element.dataset.analyser = "pending"
    try {
      const context = new Context()
      Promise.resolve(context.resume())
        .then(() => {
          if (context.state !== "running") {
            // Se reintentará en el próximo gesto
            delete element.dataset.analyser
            return context.close()
          }
          const analyser = context.createAnalyser()
          analyser.fftSize = 512
          context.createMediaElementSource(element).connect(analyser)
          analyser.connect(context.destination)
          analyserRef.current = analyser
          levelBufferRef.current = new Uint8Array(analyser.fftSize)
          element.dataset.analyser = "on"
        })
        .catch(() => {})
    } catch {
      // Sin Web Audio: la boca usa su animación en bucle
    }
  }, [])

  // Volumen de lo que suena ahora (de 0 a 1), o null si no se puede medir
  const getLevel = useCallback((): number | null => {
    const analyser = analyserRef.current
    const buffer = levelBufferRef.current
    if (!analyser || !buffer) return null
    analyser.getByteTimeDomainData(buffer)
    let sum = 0
    for (const value of buffer) sum += ((value - 128) / 128) ** 2
    return Math.sqrt(sum / buffer.length)
  }, [])

  // Dentro del clic (enviar, ▶, activar la voz): así el navegador deja sonar lo que llegue
  const prime = useCallback(() => {
    const element = audio()
    connectAnalyser(element)
    if (playingRef.current || element.dataset.primed) return
    element.dataset.primed = "1"
    element.src = SILENCE
    element.play()?.catch(() => {})
  }, [audio, connectAnalyser])

  const fail = useCallback(
    (error: unknown) => {
      stop()
      const detail = error instanceof ApiError ? error.message : undefined
      toast.error("No se pudo leer en voz", { description: detail ? `${detail} La respuesta sigue en pantalla.` : "La respuesta sigue en pantalla." })
    },
    [stop],
  )

  const pump = useCallback(function pump(): void {
    const generation = generationRef.current
    const queue = queueRef.current
    if (!playingRef.current && !queue.length) {
      setPendingKey(null)
      return
    }

    // Sonar la primera si ya está
    if (!playingRef.current && queue[0]?.status === "ready") {
      const item = queue.shift()!
      if (!item.audio) return pump()
      playingRef.current = true
      setSpeaking({ key: item.key, index: item.index })
      const element = audio()
      releaseUrl()
      urlRef.current = URL.createObjectURL(item.audio)
      element.src = urlRef.current
      element.onended = () => {
        if (generation !== generationRef.current) return
        playingRef.current = false
        if (!queueRef.current.length) setSpeaking(null)
        pump()
      }
      Promise.resolve(element.play()).catch((error: unknown) => {
        if (generation !== generationRef.current) return
        // El navegador no deja reproducir sin un clic: con ▶ sí podrá
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          stop()
          toast.error("Tu navegador no dejó reproducir la voz", { description: "Pulsa «Escuchar» en la respuesta para oírla." })
        } else fail(error)
      })
    }

    // Pedir la siguiente: una petición en vuelo y como mucho una esperando turno
    const fetching = queue.some((item) => item.status === "fetching")
    const buffered = queue.filter((item) => item.status === "ready").length
    const next = queue.find((item) => item.status === "waiting")
    if (fetching || !next || buffered >= 1) return

    const cached = cacheRef.current.get(next.text)
    if (cached !== undefined) {
      next.status = "ready"
      next.audio = cached
      return pump()
    }

    next.status = "fetching"
    abortRef.current = new AbortController()
    lariaAPI.speech
      .synthesize(next.text, next.emotion, abortRef.current.signal)
      .then((blob) => {
        if (generation !== generationRef.current) return
        if (cacheRef.current.size >= CACHE_LIMIT) cacheRef.current.delete(cacheRef.current.keys().next().value!)
        cacheRef.current.set(next.text, blob)
        next.status = "ready"
        next.audio = blob
        pump()
      })
      .catch((error: unknown) => {
        if (generation !== generationRef.current) return
        // Un trozo demasiado largo se salta; lo demás corta la lectura
        if (error instanceof ApiError && error.status === 422) {
          queueRef.current = queueRef.current.filter((item) => item !== next)
          return pump()
        }
        fail(error)
      })
  }, [audio, fail, stop])

  const enqueue = useCallback(
    (chunks: string[], emotion: SpeechEmotion, key: string, firstIndex = 0) => {
      const items = chunks
        .map((chunk, i): QueueItem => ({ text: chunk.trim(), emotion, key, index: firstIndex + i, status: "waiting" }))
        .filter((item) => item.text)
      if (!items.length) return
      queueRef.current.push(...items)
      setPendingKey(key)
      pump()
    },
    [pump],
  )

  // ▶ en un mensaje: lo lee entero (lo ya oído sale de memoria)
  const playMessage = useCallback(
    (key: string, text: string, emotion: SpeechEmotion) => {
      stop()
      prime()
      enqueue(takeSpeakable(text, true, maxChars).chunks, emotion, key)
    },
    [enqueue, maxChars, prime, stop],
  )

  const setMode = useCallback(
    (next: SpeechMode) => {
      setModeState(next)
      try {
        localStorage.setItem(MODE_KEY, next)
      } catch {
        // Sin almacenamiento, la elección dura lo que la página
      }
      if (next === "voice") prime()
      else stop()
    },
    [prime, stop],
  )

  useEffect(() => stop, [stop])

  return { enabled, configLoaded, maxChars, mode, setMode, speaking, speakingKey: speaking?.key ?? null, pendingKey, getLevel, enqueue, playMessage, prime, stop }
}
