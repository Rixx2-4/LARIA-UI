"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { GraduationCap, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "../components/app-shell"
import { RequireAuth } from "../components/require-auth"
import { lariaAPI, type LearningPath } from "@/lib/laria-api"
import { classHref, placementHref } from "@/lib/routes"
import { classGroups } from "@/lib/classes"

// Las clases guiadas del estudiante (una por tema), agrupadas por cómo van:
// en curso, a falta de la nivelación y completadas
export default function ClasesPage() {
  return (
    <RequireAuth>
      <Clases />
    </RequireAuth>
  )
}

function Clases() {
  const [paths, setPaths] = useState<LearningPath[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setPaths(null)
    try {
      setPaths(await lariaAPI.paths.list())
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar tus clases")
    }
  }, [])

  useEffect(() => {
    // Carga al abrir: el estado se actualiza tras el await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const groups = paths ? classGroups(paths) : null
  const empty = groups && !groups.inProgress.length && !groups.needsPlacement.length && !groups.completed.length

  return (
    <AppShell>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight">Mis clases</h1>

          {!paths && !error && (
            <p role="status" className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Cargando tus clases…
            </p>
          )}

          {error && (
            <div role="alert" className="space-y-3 rounded-xl border border-border bg-card p-5">
              <p>{error}</p>
              <Button variant="outline" onClick={load} className="gap-2">
                <RefreshCw className="h-4 w-4" aria-hidden />
                Reintentar
              </Button>
            </div>
          )}

          {empty && (
            <div className="space-y-3 rounded-xl border border-border bg-card p-6">
              <p className="font-medium">Aún no tienes clases</p>
              <p className="text-sm text-muted-foreground">
                Nivélate en un tema y LARIA te prepara una clase a tu medida, paso a paso.
              </p>
              <Button asChild>
                <Link href={placementHref()}>Nivelarme en un tema</Link>
              </Button>
            </div>
          )}

          {groups && groups.inProgress.length > 0 && (
            <ClassSection title="En curso">
              {groups.inProgress.map((path) => (
                <ClassRow
                  key={path.id}
                  path={path}
                  detail={path.teaching?.concept_title ? `Ahora: ${path.teaching.concept_title}` : null}
                  action={<Link href={classHref(path.id)}>Continuar</Link>}
                />
              ))}
            </ClassSection>
          )}

          {groups && groups.needsPlacement.length > 0 && (
            <ClassSection title="Pendientes de nivelación">
              {groups.needsPlacement.map((path) => (
                <ClassRow
                  key={path.id}
                  path={path}
                  detail="Antes de empezar, unas preguntas para saber tu nivel"
                  action={<Link href={placementHref(path.topic ?? undefined)}>Hacer la nivelación</Link>}
                />
              ))}
            </ClassSection>
          )}

          {groups && groups.completed.length > 0 && (
            <ClassSection title="Completadas">
              {groups.completed.map((path) => (
                <ClassRow
                  key={path.id}
                  path={path}
                  detail="Si hace tiempo que no la practicas, LARIA te propondrá un repaso"
                  action={<Link href={classHref(path.id)}>Abrir</Link>}
                  secondary
                />
              ))}
            </ClassSection>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function ClassSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="space-y-3">{children}</ul>
    </section>
  )
}

function ClassRow({
  path,
  detail,
  action,
  secondary = false,
}: {
  path: LearningPath
  detail: string | null
  action: React.ReactNode
  secondary?: boolean
}) {
  const percent = Math.round(Math.min(1, Math.max(0, path.progress ?? 0)) * 100)
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="truncate font-medium">{path.title || path.topic}</p>
          {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{percent}%</span>
          </div>
        </div>
      </div>
      <Button asChild size="sm" variant={secondary ? "outline" : "default"} className="self-start sm:self-auto">
        {action}
      </Button>
    </li>
  )
}
