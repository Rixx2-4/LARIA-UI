"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

export const THINKING_PHRASES = [
  "Pensando…",
  "Cocinando la respuesta…",
  "Repasando tus apuntes…",
  "Conectando ideas…",
  "Buscando un buen ejemplo…",
  "Afinando la explicación…",
  "Casi listo…",
]

const PHRASE_MS = 2200

// Lo que se ve mientras el tutor prepara la respuesta: un destello que late, tres
// puntos y una frase que va cambiando (o lo que el backend diga que está haciendo)
export function ThinkingIndicator({ label }: { label?: string }) {
  const [phraseIndex, setPhraseIndex] = useState(0)

  useEffect(() => {
    if (label) return
    const timer = setInterval(() => setPhraseIndex((i) => (i + 1) % THINKING_PHRASES.length), PHRASE_MS)
    return () => clearInterval(timer)
  }, [label])

  const text = label || THINKING_PHRASES[phraseIndex]

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-[14px] text-muted-foreground">
      <Sparkles className="thinking-sparkle h-4 w-4 shrink-0 text-primary" aria-hidden />
      {/* La key reinicia la animación de entrada en cada frase nueva */}
      <span key={text} className="thinking-text">
        {text}
      </span>
      <span className="thinking-dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
    </div>
  )
}
