"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/app/contexts/auth-context"
import { lariaAPI } from "@/lib/laria-api"
import { onReplayOnboarding } from "@/lib/onboarding"
import { LariaMascot, type MascotEmotion } from "./laria-mascot"

// Tutorial de bienvenida: la primera vez que se entra en la app (cuenta nueva, con
// onboarding_completed = false), LARIA presenta lo principal en seis pasos y
// resalta el elemento real de la pantalla cuando está a la vista. Al terminarlo o
// saltarlo se marca como visto en la cuenta (no vuelve en otro dispositivo); desde
// el menú de cuenta se puede volver a ver

interface Step {
  title: string
  text: string
  emotion: MascotEmotion
  // El elemento que se resalta (data-tour); si no se ve (p. ej. menú plegado en el
  // móvil), el paso se muestra centrado
  target?: string
}

export const ONBOARDING_STEPS: Step[] = [
  {
    title: "¡Hola! Soy LARIA",
    text: "Soy tu tutor en Plenum. Me adapto a cómo aprendes: a tu nivel, a lo que te cuesta y a cómo prefieres que te explique.",
    emotion: "celebratory",
  },
  {
    title: "Pregúntame lo que quieras",
    text: "Escríbeme aquí o dicta con el micrófono. Te explico paso a paso, con ejemplos y fórmulas bien escritas.",
    emotion: "encouraging",
    target: "chat",
  },
  {
    title: "Empezamos por tu nivel",
    text: "Dime «quiero aprender» y el tema. Te hago una prueba corta para saber de dónde partir; no es un examen.",
    emotion: "calm",
    target: "nuevo-chat",
  },
  {
    title: "Tus clases, por tramos",
    text: "Cada tema es una ruta: básico, intermedio y avanzado. Al terminar un tramo, la prueba de paso abre el siguiente. Las tienes en «Mis clases».",
    emotion: "surprised",
    target: "clases",
  },
  {
    title: "Con tus apuntes y libros",
    text: "Súbelos con el clip y te explico a partir de ellos, y te hago cuestionarios sobre lo que has leído.",
    emotion: "encouraging",
    target: "adjuntar",
  },
  {
    title: "A tu ritmo",
    text: "En tu perfil eliges mi voz, cómo prefieres que te explique y cuánto quieres estudiar al día. ¡Empezamos!",
    emotion: "celebratory",
    target: "perfil",
  },
]

// Dónde está el elemento a resaltar, si se ve en pantalla
function targetRect(target: string | undefined): DOMRect | null {
  if (!target || typeof document === "undefined") return null
  const element = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
  const rect = element?.getBoundingClientRect()
  if (!rect || rect.width === 0 || rect.height === 0) return null
  if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) return null
  return rect
}

export function OnboardingTour() {
  const { user } = useAuth()
  // Sin el campo (backend anterior) se da por visto: no se muestra a todo el mundo
  const firstTime = user?.onboarding_completed === false
  const [dismissed, setDismissed] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  useEffect(
    () =>
      onReplayOnboarding(() => {
        setStep(0)
        setReplaying(true)
      }),
    [],
  )

  const open = replaying || (firstTime && !dismissed)
  const current = ONBOARDING_STEPS[step]
  const last = step === ONBOARDING_STEPS.length - 1

  const finish = useCallback(() => {
    setDismissed(true)
    setReplaying(false)
    setStep(0)
    // Visto en la cuenta, tanto si se termina como si se salta (volver a verlo no cuenta)
    if (firstTime) lariaAPI.auth.completeOnboarding().catch(() => {})
  }, [firstTime])

  // El hueco del resaltado sigue al elemento (cambios de tamaño, scroll)
  useLayoutEffect(() => {
    if (!open) return
    const update = () => setRect(targetRect(current.target))
    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [open, current.target])

  useEffect(() => {
    if (!open) return
    nextRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, step, finish])

  if (!open) return null

  const pad = 6
  return (
    <div className="fixed inset-0 z-[100]">
      {/* Fondo oscuro con un hueco sobre el elemento que se presenta */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-xl ring-2 ring-primary transition-all duration-300 motion-reduce:transition-none"
          style={{
            left: rect.left - pad,
            top: rect.top - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/55" />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-titulo"
        aria-describedby="tutorial-texto"
        className="fixed inset-x-3 bottom-3 mx-auto max-w-md rounded-2xl border border-border bg-background p-4 shadow-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:p-5"
      >
        <div className="flex gap-3">
          <LariaMascot state="speaking" emotion={current.emotion} className="h-20 w-16 shrink-0" />
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {step + 1}/{ONBOARDING_STEPS.length}
            </p>
            <h2 id="tutorial-titulo" className="font-semibold">
              {current.title}
            </h2>
            <p id="tutorial-texto" className="text-sm text-muted-foreground">
              {current.text}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>
            Saltar
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((n) => n - 1)}>
                Atrás
              </Button>
            )}
            <Button ref={nextRef} size="sm" onClick={() => (last ? finish() : setStep((n) => n + 1))}>
              {last ? "¡Empezar!" : "Siguiente"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
