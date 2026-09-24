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

// Dictado con el reconocimiento de voz del navegador (Chrome, Edge, Safari; no Firefox).
// onText recibe cada frase ya reconocida.
export function useDictation(onText: (text: string) => void, onError?: (message: string) => void) {
  const [isSupported] = useState(() => getRecognitionCtor() !== null)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onTextRef = useRef(onText)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onTextRef.current = onText
    onErrorRef.current = onError
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
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor || recognitionRef.current) return
    const recognition = new Ctor()
    recognition.lang = "es-ES"
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) onTextRef.current(result[0].transcript.trim())
      }
    }
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        onErrorRef.current?.("Permite el acceso al micrófono para dictar")
      } else if (event.error === "audio-capture") {
        onErrorRef.current?.("No se encontró ningún micrófono")
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        onErrorRef.current?.("No se pudo usar el dictado")
      }
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setIsListening(false)
    }
    try {
      recognition.start()
    } catch {
      onErrorRef.current?.("No se pudo usar el dictado")
      return
    }
    recognitionRef.current = recognition
    setIsListening(true)
  }, [])

  useEffect(() => cancel, [cancel])

  return { isSupported, isListening, start, stop, cancel }
}
