"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Lo mínimo de la Web Speech API que se usa (TypeScript no la incluye)
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

interface DictationCallbacks {
  // Una frase ya reconocida y definitiva
  onFinal: (text: string) => void
  // Lo que se va entendiendo de la frase en curso ("" cuando no hay nada pendiente)
  onInterim?: (text: string) => void
  onError?: (message: string) => void
}

// Dictado con el reconocimiento de voz del navegador (Chrome, Edge, Safari; no Firefox)
export function useDictation(callbacks: DictationCallbacks) {
  const [isSupported] = useState(() => getRecognitionCtor() !== null)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const callbacksRef = useRef(callbacks)
  useEffect(() => {
    callbacksRef.current = callbacks
  })

  // Termina de escuchar pero entrega la frase que estuviera a medias
  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  // Corta en seco y descarta lo pendiente (al enviar, al salir de la pantalla)
  const cancel = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
    recognition.abort()
    recognitionRef.current = null
    setIsListening(false)
    callbacksRef.current.onInterim?.("")
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor || recognitionRef.current) return
    const recognition = new Ctor()
    recognition.lang = "es-ES"
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) callbacksRef.current.onFinal(result[0].transcript.trim())
        else interim += result[0].transcript
      }
      callbacksRef.current.onInterim?.(interim.trim())
    }
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        callbacksRef.current.onError?.("Permite el acceso al micrófono para dictar")
      } else if (event.error === "audio-capture") {
        callbacksRef.current.onError?.("No se encontró ningún micrófono")
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        callbacksRef.current.onError?.("No se pudo usar el dictado")
      }
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setIsListening(false)
      // Lo que no llegó a ser definitivo se descarta
      callbacksRef.current.onInterim?.("")
    }
    try {
      recognition.start()
    } catch {
      callbacksRef.current.onError?.("No se pudo usar el dictado")
      return
    }
    recognitionRef.current = recognition
    setIsListening(true)
  }, [])

  useEffect(() => cancel, [cancel])

  return { isSupported, isListening, start, stop, cancel }
}
