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
  // Todo lo dictado en esta pulsación del micrófono: lo ya definitivo y lo que se va
  // entendiendo de la frase en curso. Es el total, no un trozo nuevo: quien lo use
  // debe REEMPLAZAR lo dictado antes, no añadirlo
  onTranscript: (finalText: string, interim: string) => void
  onError?: (message: string) => void
}

type ResultList = ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>

// El texto de la sesión a partir de TODOS los resultados del evento (no solo los
// nuevos). Chrome en Android repite la misma frase o la entrega acumulada («hola»,
// «hola qué», «hola qué tal») en cada actualización: una frase igual a la anterior,
// o contenida en ella, no se vuelve a sumar; una que la amplía, la sustituye
export function transcriptFrom(results: ResultList): { finalText: string; interim: string } {
  const finals: string[] = []
  let interim = ""
  for (let i = 0; i < results.length; i++) {
    const text = results[i][0].transcript.trim()
    if (!text) continue
    if (!results[i].isFinal) {
      interim = interim ? `${interim} ${text}` : text
      continue
    }
    const last = finals.at(-1)
    if (last !== undefined && (last === text || last.startsWith(text))) continue
    if (last !== undefined && text.startsWith(last)) finals[finals.length - 1] = text
    else finals.push(text)
  }
  // Lo provisional que repite lo ya definitivo tampoco se muestra dos veces
  const finalText = finals.join(" ")
  if (interim && finalText.endsWith(interim)) interim = ""
  return { finalText, interim }
}

// En el móvil el modo continuo es el que repite: allí, una frase por pulsación
function isMobile(): boolean {
  if (typeof window === "undefined") return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || !!window.matchMedia?.("(pointer: coarse)").matches
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
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor || recognitionRef.current) return
    const recognition = new Ctor()
    recognition.lang = "es-ES"
    recognition.continuous = !isMobile()
    recognition.interimResults = true
    // Lo definitivo de la sesión, para entregarlo también al terminar
    let finalText = ""
    recognition.onresult = (event) => {
      const transcript = transcriptFrom(event.results)
      finalText = transcript.finalText
      callbacksRef.current.onTranscript(transcript.finalText, transcript.interim)
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
      callbacksRef.current.onTranscript(finalText, "")
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
