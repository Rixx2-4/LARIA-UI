"use client"

import { useEffect, useState, type CSSProperties } from "react"

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

// «Loading V2» de useAnimations (https://useanimations.com/icons/loading-v2, MIT): una
// cuadrícula de 4×4 cuadrados que crecen y menguan en ola, en diagonal. Reproduce su
// animación Lottie con SVG y CSS (.thinking-loader en globals.css), sin cargar el
// reproductor de Lottie; toma el color del texto
const LOADER_CELLS = [0, 1, 2, 3].flatMap((row) => [0, 1, 2, 3].map((col) => ({ row, col })))

function ThinkingLoader() {
  return (
    <svg viewBox="-4 -4 32 32" className="thinking-loader h-5 w-5 shrink-0 text-primary" fill="currentColor" aria-hidden>
      {LOADER_CELLS.map(({ row, col }) => (
        <rect
          key={`${row}-${col}`}
          x={col * 6}
          y={row * 6}
          width={6}
          height={6}
          // Cada diagonal empieza un poco después que la anterior
          style={{ "--diagonal": row + col } as CSSProperties}
        />
      ))}
    </svg>
  )
}

// Lo que se ve mientras el tutor prepara la respuesta: la cuadrícula animada, tres
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
      <ThinkingLoader />
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
