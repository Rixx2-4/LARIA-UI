"use client"

import { useCallback, useEffect, useState } from "react"
import { lariaAPI, onEvidenceRecorded, type ReviewAgenda } from "@/lib/laria-api"
import { timezone } from "./use-study-time"

// El backend aplica cada intento a la agenda de forma asíncrona (outbox): se vuelve a
// pedir un poco después de calificarse
export const REFRESH_AFTER_EVIDENCE_MS = 2500

// La agenda de repasos (ADR-051). Sin el endpoint (backend anterior) queda en null y
// failed, y quien la muestre decide si lo dice o lo calla
export function useReviewAgenda(enabled = true, limit = 50) {
  const [agenda, setAgenda] = useState<ReviewAgenda | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const loaded = await lariaAPI.learning.reviews(timezone(), limit)
      // Una respuesta sin la forma de la agenda (otro backend, un proxy) no debe romper
      // la barra lateral: cuenta como fallo
      if (!loaded?.counts || !Array.isArray(loaded.items)) throw new Error("Agenda con otra forma")
      setAgenda(loaded)
    } catch {
      setFailed(true)
    }
  }, [limit])

  useEffect(() => {
    if (!enabled) return
    // Carga al abrir: el estado se actualiza tras la respuesta
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = onEvidenceRecorded(() => {
      clearTimeout(timer)
      timer = setTimeout(load, REFRESH_AFTER_EVIDENCE_MS)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [enabled, load])

  return { agenda, failed, reload: load }
}
