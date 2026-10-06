"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ChevronsDown, Square, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MessageContent } from "@/app/components/message-content"
import { LariaMascot, type MascotEmotion, type MascotState } from "@/app/components/laria-mascot"
import { takeSpeakable } from "@/lib/speech-chunks"
import type { useSpeech } from "@/hooks/use-speech"

// La explicación en una pizarra, con LARIA al lado. Con «Leer en voz», cada frase
// aparece en la pizarra cuando LARIA empieza a decirla (son los mismos trozos que
// pide la voz: no hay peticiones extra). Con «Solo texto», o si la voz falla, se ve
// todo de golpe. «Mostrar todo» deja leer por delante. La comprobación (children)
// aparece cuando la pizarra está completa

type Speech = ReturnType<typeof useSpeech>

// El navegador solo deja sonar audio tras un gesto del usuario en la página. Al
// llegar desde un clic (Continuar, la nivelación) ya lo hubo; tras recargar, no
function canAutoplay(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
  return activation ? activation.hasBeenActive : true
}

// Un dato importante: algo en negrita, una fórmula aparte, una cita o una frase que
// lo anuncia («recuerda», «clave», «fíjate»…). Mientras LARIA lo dice, señala la pizarra
const IMPORTANT = /\*\*[^*\n]+\*\*|\$\$|\\\[|^\s*>|\b(importante|recuerda|clave|fíjate|ojo|regla|fórmula|definición)\b/im

export function isImportant(chunk: string): boolean {
  return IMPORTANT.test(chunk)
}

export function ClassBoard({
  lessonKey,
  markdown,
  speech,
  emotion = "calm",
  children,
}: {
  lessonKey: string
  markdown: string
  speech: Speech
  // Cómo se siente LARIA al explicar esta lección (p. ej. paciente al repetirla)
  emotion?: MascotEmotion
  children: ReactNode
}) {
  const chunks = useMemo(() => takeSpeakable(markdown, true, speech.maxChars).chunks, [markdown, speech.maxChars])
  const voiceOn = speech.enabled && speech.mode === "voice"
  // Hasta saber si hay voz, la pizarra espera vacía (si no, el texto aparecería y se
  // escondería al empezar la lectura)
  const [revealed, setRevealed] = useState(0)
  const [reading, setReading] = useState(false)
  // Pidió ver todo sin esperar a que LARIA termine de hablar
  const [skipped, setSkipped] = useState(false)
  const { enqueue, prime, stop, speaking, pendingKey, getLevel } = speech

  const start = useCallback(() => {
    stop()
    prime()
    setRevealed(0)
    setSkipped(false)
    setReading(true)
    enqueue(chunks, "calm", lessonKey)
  }, [chunks, enqueue, lessonKey, prime, stop])

  // Lección nueva: con voz (y si el navegador deja) se presenta leyéndola; si no, entera
  const startedFor = useRef<string | null>(null)
  useEffect(() => {
    if (startedFor.current === lessonKey || !speech.configLoaded) return
    startedFor.current = lessonKey
    // Arranca la lectura de esta lección: el estado se ajusta desde aquí
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (voiceOn && canAutoplay()) start()
    else setRevealed(chunks.length)
  }, [lessonKey, voiceOn, speech.configLoaded, start, chunks.length])

  // La pizarra sigue a la voz: aparece la frase que empieza a sonar
  const speakingIndex = speaking?.key === lessonKey ? speaking.index : null
  if (reading && speakingIndex !== null && revealed < speakingIndex + 1) setRevealed(speakingIndex + 1)
  // Terminó, se detuvo o falló: se ve todo
  const pending = pendingKey === lessonKey
  if (reading && !pending && speakingIndex === null) {
    setReading(false)
    setRevealed(chunks.length)
  }

  // La comprobación, cuando LARIA termina de explicar (o al pedir verlo todo)
  const complete = revealed >= chunks.length && (!reading || skipped)
  const mascot: MascotState = speakingIndex !== null ? "speaking" : reading ? "thinking" : "idle"
  const pointing = speakingIndex !== null && isImportant(chunks[speakingIndex] ?? "")

  // Mientras habla, la boca sigue el volumen real del audio (un fotograma cada vez,
  // tocando solo una variable CSS). Sin medición, o con «reducir movimiento», nada
  const mascotRef = useRef<SVGSVGElement>(null)
  const talking = mascot === "speaking"
  useEffect(() => {
    const svg = mascotRef.current
    if (!talking || !svg || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    let frame = 0
    let smooth = 0
    const tick = () => {
      const level = getLevel()
      if (level !== null) {
        // El habla ronda 0,02–0,25 de volumen: se amplía y se suaviza para que no tiemble
        smooth = smooth * 0.5 + Math.min(1, level * 5) * 0.5
        svg.dataset.lipsync = "on"
        svg.style.setProperty("--mouth", smooth.toFixed(2))
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      delete svg.dataset.lipsync
      svg.style.removeProperty("--mouth")
    }
  }, [talking, getLevel])
  const shown = chunks.slice(0, revealed).join("")

  return (
    <div className="space-y-6">
      <div className="relative flex items-end gap-4">
        <div className="min-w-0 flex-1 rounded-2xl border-[6px] border-[#8a6a43] bg-[#1f2d2a] p-5 pb-16 text-white/90 shadow-inner sm:p-7 sm:pb-7 lg:min-h-64">
          <div className="message-text space-y-3 leading-relaxed [&_.katex]:text-white [&_code]:bg-white/10 [&_pre]:bg-white/10" aria-live="polite">
            {shown ? <MessageContent content={shown} /> : <p className="text-white/50">LARIA está preparando la pizarra…</p>}
          </div>
        </div>
        <LariaMascot
          ref={mascotRef}
          state={mascot}
          emotion={pointing ? "surprised" : emotion}
          pointing={pointing}
          className="pointer-events-none absolute -bottom-3 right-2 w-16 sm:w-20 lg:static lg:w-36 lg:shrink-0"
        />
      </div>

      {speech.enabled && (
        <div className="flex flex-wrap items-center gap-2">
          {reading ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={stop}>
              <Square className="h-4 w-4" aria-hidden />
              Detener
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-2" onClick={start}>
              <Volume2 className="h-4 w-4" aria-hidden />
              Escuchar la explicación
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            aria-pressed={voiceOn}
            onClick={() => speech.setMode(voiceOn ? "text" : "voice")}
          >
            {voiceOn ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
            {voiceOn ? "Leer en voz" : "Solo texto"}
          </Button>
          {!complete && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => {
                setRevealed(chunks.length)
                setSkipped(true)
              }}
            >
              <ChevronsDown className="h-4 w-4" aria-hidden />
              Mostrar todo
            </Button>
          )}
        </div>
      )}

      {complete && children}
    </div>
  )
}
