"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, m, useReducedMotion } from "motion/react"
import type { DemoPiece } from "./chat-demo-content"

const QUESTION = "No entiendo la regla de la cadena. ¿Me la explicas con un ejemplo?"

type Stage = "idle" | "question" | "thinking" | "answer"

// El HTML de las fórmulas lo genera KaTeX en el servidor a partir de un texto fijo
// de la demo (chat-demo-content.ts): no viene del usuario ni de la red
function Piece({ piece }: { piece: DemoPiece }) {
  if (piece.kind === "text") return <>{piece.value}</>
  return piece.display ? (
    <span className="my-2 block overflow-x-auto" dangerouslySetInnerHTML={{ __html: piece.html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: piece.html }} />
  )
}

export function ChatDemo({ answer }: { answer: DemoPiece[][] }) {
  const total = answer.reduce((n, paragraph) => n + paragraph.length, 0)
  const reduceMotion = useReducedMotion()
  const [stage, setStage] = useState<Stage>("idle")
  const [shown, setShown] = useState(0)

  // Guion: nota del archivo → pregunta → "pensando" → respuesta
  useEffect(() => {
    if (reduceMotion) return
    const timers = [
      setTimeout(() => setStage("question"), 700),
      setTimeout(() => setStage("thinking"), 1500),
      setTimeout(() => setStage("answer"), 2400),
    ]
    return () => timers.forEach(clearTimeout)
  }, [reduceMotion])

  useEffect(() => {
    if (stage !== "answer" || shown >= total) return
    const timer = setTimeout(() => setShown((n) => n + 1), 70)
    return () => clearTimeout(timer)
  }, [stage, shown, total])

  // Con "reducir movimiento" se ve la conversación completa, sin guion
  const finished = reduceMotion || (stage === "answer" && shown >= total)
  const current: Stage | "done" = finished ? "done" : stage
  const visible = current === "done" ? total : shown

  return (
    <div
      role="img"
      aria-label="Ejemplo de conversación en LARIA: una estudiante sube el tema de derivadas y pregunta por la regla de la cadena; LARIA la explica con la fórmula y un ejemplo."
      className="overflow-hidden rounded-lg border border-foreground/15 bg-background shadow-[6px_6px_0_0] shadow-foreground/10"
    >
      <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-2.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Derivadas: regla de la cadena</span>
        <span>tema3-derivadas.pdf</span>
      </div>

      <div aria-hidden className="flex min-h-[23rem] flex-col gap-3 px-4 py-4 text-[13.5px] sm:min-h-[21rem]">
        <p className="text-center text-xs text-muted-foreground">📎 Subí el archivo: tema3-derivadas.pdf</p>

        <AnimatePresence>
          {current !== "idle" && (
            <m.div
              key="question"
              className="ml-auto max-w-[85%] rounded-2xl bg-primary px-3.5 py-2.5 text-primary-foreground"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {QUESTION}
            </m.div>
          )}

          {current === "thinking" && (
            <m.div
              key="thinking"
              className="flex w-14 items-center justify-center gap-1 rounded-2xl bg-muted px-3 py-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {[0, 1, 2].map((i) => (
                <m.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </m.div>
          )}

          {(current === "answer" || current === "done") && (
            <m.div
              key="answer"
              className="max-w-[92%] rounded-2xl bg-muted px-3.5 py-3 leading-relaxed"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Los párrafos se van llenando trozo a trozo */}
              {(() => {
                let before = 0
                return answer.map((paragraph, i) => {
                  const start = before
                  before += paragraph.length
                  if (visible <= start) return null
                  return (
                    <p key={i} className="my-2 first:mt-0 last:mb-0">
                      {paragraph.slice(0, visible - start).map((piece, j) => (
                        <Piece key={j} piece={piece} />
                      ))}
                    </p>
                  )
                })
              })()}
              {current === "done" && (
                <m.div
                  className="mt-2 flex gap-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span>Copiar</span>
                  <span className="rounded bg-secondary/60 px-1.5">Explicación</span>
                  <span className="rounded bg-green-500/20 px-1.5 text-green-700 dark:text-green-300">Tutoría</span>
                </m.div>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
