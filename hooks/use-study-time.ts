"use client"

import { useEffect, useRef, useState } from "react"
import { lariaAPI, type StudyTimeSummary } from "@/lib/laria-api"

// El tiempo de estudio en una clase: cuenta la sesión en la pantalla y avisa al
// backend cada minuto, solo con la pestaña visible y alguien estudiando (actividad
// en los últimos 2 minutos o LARIA hablando). El backend lleva la cuenta del día,
// la racha y si se cumplió el objetivo; acota lo que cuenta, así que varias
// pestañas no suman doble

const PING_MS = 60_000
const IDLE_MS = 120_000

export function timezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

export function useStudyTime({ busy = false }: { busy?: boolean } = {}) {
  const [summary, setSummary] = useState<StudyTimeSummary | null>(null)
  const [sessionSeconds, setSessionSeconds] = useState(0)
  // Al abrir la clase cuenta como actividad (se fija al montar)
  const lastActivityRef = useRef(0)
  const busyRef = useRef(busy)
  useEffect(() => {
    busyRef.current = busy
  })

  useEffect(() => {
    let cancelled = false
    lariaAPI.study
      .summary(timezone())
      .then((loaded) => !cancelled && setSummary(loaded))
      .catch(() => {})

    const markActive = () => {
      lastActivityRef.current = Date.now()
    }
    markActive()
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const
    events.forEach((name) => window.addEventListener(name, markActive, { passive: true }))

    const studying = () =>
      document.visibilityState === "visible" && (busyRef.current || Date.now() - lastActivityRef.current < IDLE_MS)

    // El cronómetro de la sesión avanza cada segundo que se está estudiando
    const clock = setInterval(() => {
      if (studying()) setSessionSeconds((s) => s + 1)
    }, 1000)
    // Y cada minuto se le cuenta al backend
    const ping = setInterval(() => {
      if (!studying()) return
      lariaAPI.study
        .ping(60, timezone())
        .then((next) => !cancelled && setSummary(next))
        .catch(() => {})
    }, PING_MS)

    return () => {
      cancelled = true
      clearInterval(clock)
      clearInterval(ping)
      events.forEach((name) => window.removeEventListener(name, markActive))
    }
  }, [])

  return { summary, sessionSeconds }
}
