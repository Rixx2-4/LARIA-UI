"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { lariaAPI, type NextSuggestion } from "@/lib/laria-api"
import { classHref, placementHref } from "@/lib/routes"

// Cómo seguir tras completar una ruta: el mismo tema a otro nivel o temas nuevos.
// «Empezar» crea la ruta y abre la clase, o lleva a nivelarse si hace falta

const KIND_LABEL: Record<NextSuggestion["kind"], string> = {
  level_up: "Sube de nivel",
  advance: "Siguiente paso",
  related: "Tema relacionado",
}

export function NextSuggestions({ pathId, title = "¿Cómo seguimos?" }: { pathId: string; title?: string }) {
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<NextSuggestion[] | null>(null)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    lariaAPI.paths
      .next(pathId)
      .then((loaded) => !cancelled && setSuggestions(loaded))
      .catch(() => !cancelled && setSuggestions([]))
    return () => {
      cancelled = true
    }
  }, [pathId])

  const start = async (suggestion: NextSuggestion) => {
    if (suggestion.needs_placement) return router.push(placementHref(suggestion.topic))
    setStarting(suggestion.topic)
    try {
      const path = await lariaAPI.paths.fromTopic(suggestion.topic)
      router.push(classHref(path.id))
    } catch (error) {
      setStarting(null)
      toast.error("No se pudo preparar la clase", { description: error instanceof Error ? error.message : undefined })
    }
  }

  if (suggestions === null) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
        Buscando cómo seguir…
      </p>
    )
  }
  if (!suggestions.length) return null

  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {suggestions.map((suggestion) => (
          <li key={`${suggestion.kind}:${suggestion.topic}`} className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{KIND_LABEL[suggestion.kind]}</p>
              <p className="font-medium">{suggestion.label}</p>
              <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
            </div>
            <Button size="sm" className="gap-1 self-start" onClick={() => start(suggestion)} disabled={starting !== null}>
              {starting === suggestion.topic ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {suggestion.needs_placement ? "Nivelarme" : "Empezar"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
