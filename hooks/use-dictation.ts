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

// Qué decirle al usuario según el error del reconocimiento de voz. El navegador
// transcribe en sus servidores (Google en Chrome, Microsoft en Edge, Apple en
// Safari): Brave, Chromium, Opera o Vivaldi traen la función pero no ese servicio, y
// fallan con "network" en cuanto se pulsa el micrófono
export function dictationErrorMessage(error: string): string | null {
  switch (error) {
    case "aborted":
    case "no-speech":
      return null
    case "not-allowed":
      return "Permite el acceso al micrófono para dictar (en el candado de la barra de direcciones)."
    case "audio-capture":
      return "No se encontró ningún micrófono."
    case "network":
      return "Este navegador no tiene servicio de dictado. Prueba en Chrome, Edge o Safari, o escribe tu mensaje."
    case "service-not-allowed":
      return "El dictado está desactivado en este navegador o en el sistema. Prueba en Chrome, Edge o Safari."
    case "language-not-supported":
      return "Este navegador no dicta en español. Prueba en Chrome, Edge o Safari."
    default:
      return "No se pudo usar el dictado. Prueba de nuevo o escribe tu mensaje."
  }
}

const UNAVAILABLE = new Set(["network", "service-not-allowed", "language-not-supported"])

interface DictationCallbacks {
  // Una frase ya reconocida y definitiva
  onFinal: (text: string) => void
  // Lo que se va entendiendo de la frase en curso ("" cuando no hay nada pendiente)
  onInterim?: (text: string) => void
  onError?: (message: string) => void
}

// Dictado con el reconocimiento de voz del navegador (Chrome, Edge, Safari; no Firefox)
export function useDictation(callbacks: DictationCallbacks) {
  const [isSupported, setIsSupported] = useState(() => getRecognitionCtor() !== null)
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
      const message = dictationErrorMessage(event.error)
      if (message) callbacksRef.current.onError?.(message)
      // Sin servicio de dictado no se arreglará reintentando: fuera el micrófono
      if (UNAVAILABLE.has(event.error)) setIsSupported(false)
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
      callbacksRef.current.onError?.(dictationErrorMessage("start-failed")!)
      return
    }
    recognitionRef.current = recognition
    setIsListening(true)
  }, [])

  useEffect(() => cancel, [cancel])

  return { isSupported, isListening, start, stop, cancel }
}
