"use client"

import { useEffect, useState } from "react"
import { lariaAPI, type Document } from "@/lib/laria-api"

const POLL_MS = 3000

export function isProcessing(doc: Document): boolean {
  return doc.status !== "analyzed" && doc.status !== "analysis_failed" && !doc.has_analysis
}

// Los documentos del usuario; mientras alguno se procesa, se vuelve a consultar
export function useDocuments(enabled: boolean) {
  const [documents, setDocuments] = useState<Document[]>([])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const load = async () => {
      try {
        const docs = await lariaAPI.documents.list()
        if (cancelled) return
        setDocuments(docs)
        if (docs.some(isProcessing)) timer = setTimeout(load, POLL_MS)
      } catch {
        if (!cancelled) setDocuments([])
      }
    }

    load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [enabled])

  return { documents }
}
