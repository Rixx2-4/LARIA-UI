"use client"

import { useEffect, useRef, useState } from "react"
import { m, useInView, useReducedMotion } from "motion/react"
import { Check } from "lucide-react"
import { FileTypeIcon } from "../file-type-icon"
import { mimeFromFilename } from "@/lib/file-types"

const frame = "rounded-lg border border-foreground/15 bg-background shadow-[6px_6px_0_0] shadow-foreground/10"

// Cuándo empezar: al entrar en pantalla (o ya, si se pidió reducir movimiento)
function usePlay<T extends Element>() {
  const ref = useRef<T>(null)
  const inView = useInView(ref, { once: true, margin: "0px 0px -120px 0px" })
  const reduceMotion = useReducedMotion()
  return { ref, play: inView || !!reduceMotion, instant: !!reduceMotion }
}

const FILES = [
  { name: "tema3-derivadas.pdf", size: "2,4 MB" },
  { name: "apuntes-clase-12.docx", size: "380 KB" },
  { name: "ejercicios.py", size: "6 KB" },
]

export function UploadMock() {
  const { ref, play, instant } = usePlay<HTMLDivElement>()
  const [analyzed, setAnalyzed] = useState(0)

  useEffect(() => {
    if (!play) return
    const timers = FILES.map((_, i) => setTimeout(() => setAnalyzed(i + 1), instant ? 0 : 900 + i * 700))
    return () => timers.forEach(clearTimeout)
  }, [play, instant])

  return (
    <div ref={ref} aria-hidden className={`${frame} p-4`}>
      <p className="mb-3 text-xs font-medium text-muted-foreground">Mis documentos</p>
      <ul className="space-y-2">
        {FILES.map((file, i) => {
          const done = analyzed > i
          return (
            <m.li
              key={file.name}
              className="flex items-center gap-3 rounded-md border border-foreground/10 px-3 py-2.5"
              initial={{ opacity: 0, x: -12 }}
              animate={play ? { opacity: 1, x: 0 } : undefined}
              transition={{ delay: i * 0.15, duration: 0.4 }}
            >
              <FileTypeIcon mimeType={mimeFromFilename(file.name)} className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{file.name}</p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <m.div
                    className="h-full bg-foreground/70"
                    initial={{ width: "0%" }}
                    animate={play ? { width: "100%" } : undefined}
                    transition={{ delay: i * 0.7, duration: instant ? 0 : 0.9, ease: "easeInOut" }}
                  />
                </div>
              </div>
              <span className={`w-20 shrink-0 text-right text-[11px] ${done ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                {done ? "Analizado" : file.size}
              </span>
            </m.li>
          )
        })}
      </ul>
    </div>
  )
}

const OPTIONS = [
  { key: "A", text: "3(2x − 5)²" },
  { key: "B", text: "6(2x − 5)²" },
  { key: "C", text: "6(2x − 5)" },
]

export function QuizMock() {
  const { ref, play, instant } = usePlay<HTMLDivElement>()
  const [step, setStep] = useState<"asking" | "chosen" | "checked">("asking")

  useEffect(() => {
    if (!play) return
    const timers = [
      setTimeout(() => setStep("chosen"), instant ? 0 : 1100),
      setTimeout(() => setStep("checked"), instant ? 0 : 1900),
    ]
    return () => timers.forEach(clearTimeout)
  }, [play, instant])

  return (
    <div ref={ref} aria-hidden className={`${frame} p-4`}>
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Pregunta 3 de 5</span>
        <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300">Media</span>
      </div>
      <p className="mb-3 text-[14px] font-medium">Si f(x) = (2x − 5)³, ¿cuánto vale f′(x)?</p>
      <div className="space-y-2">
        {OPTIONS.map((option) => {
          const chosen = step !== "asking" && option.key === "B"
          const correct = step === "checked" && option.key === "B"
          return (
            <m.div
              key={option.key}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-[13px] transition-colors duration-300 ${
                correct
                  ? "border-green-600/50 bg-green-50 dark:bg-green-500/10"
                  : chosen
                    ? "border-foreground bg-foreground/5"
                    : "border-foreground/15"
              }`}
              animate={chosen && !instant ? { scale: [1, 0.98, 1] } : undefined}
              transition={{ duration: 0.25 }}
            >
              <span>
                <span className="mr-2 font-medium">{option.key}.</span>
                {option.text}
              </span>
              {correct && (
                <m.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-green-700 dark:text-green-400">
                  <Check className="h-4 w-4" />
                </m.span>
              )}
            </m.div>
          )
        })}
      </div>
    </div>
  )
}

const CONCEPTS = [
  { name: "Regla de la cadena", value: 82 },
  { name: "Derivada del producto", value: 64 },
  { name: "Límites laterales", value: 38 },
]

export function ProfileMock() {
  const { ref, play, instant } = usePlay<HTMLDivElement>()

  return (
    <div ref={ref} aria-hidden className={`${frame} p-4`}>
      <p className="mb-1 text-[13px] font-semibold">Dominio por concepto</p>
      <p className="mb-4 text-xs text-muted-foreground">Actualizado después de cada quiz</p>
      <ul className="space-y-3.5">
        {CONCEPTS.map((concept, i) => {
          const low = concept.value < 50
          return (
            <li key={concept.name}>
              <div className="mb-1.5 flex justify-between text-[12.5px]">
                <span>{concept.name}</span>
                <span className={low ? "text-destructive" : "text-muted-foreground"}>{concept.value}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <m.div
                  className={`h-full rounded-full ${low ? "bg-destructive" : "bg-foreground/80"}`}
                  initial={{ width: "0%" }}
                  animate={play ? { width: `${concept.value}%` } : undefined}
                  transition={{ delay: instant ? 0 : 0.2 + i * 0.15, duration: instant ? 0 : 1, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </li>
          )
        })}
      </ul>
      <m.p
        className="mt-4 border-t border-foreground/10 pt-3 text-[12.5px]"
        initial={{ opacity: 0 }}
        animate={play ? { opacity: 1 } : undefined}
        transition={{ delay: instant ? 0 : 1.2 }}
      >
        <span className="font-medium">Para repasar:</span> límites laterales, con 3 fallos seguidos.
      </m.p>
    </div>
  )
}
