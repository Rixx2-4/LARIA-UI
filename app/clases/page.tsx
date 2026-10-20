"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check, ChevronDown, Circle, CircleDot, Lock, Plus, RefreshCw, RotateCcw, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AppShell } from "../components/app-shell"
import { RequireAuth } from "../components/require-auth"
import { LariaMascot } from "../components/laria-mascot"
import { DeleteClassDialog } from "../components/delete-class-dialog"
import { lariaAPI, type LearningPath, type PathModule, type PlacementLevel } from "@/lib/laria-api"
import { classHref, passageTestHref, placementHref } from "@/lib/routes"
import { classGroups, currentTier, lastStudied, masterySteps, moduleLabel, tierDone, tierProgress } from "@/lib/classes"
import { LEVEL_NAME } from "../quiz/quiz-parts"
import { DailyProgress } from "../components/study-progress"
import { NextSuggestions } from "../components/next-suggestions"
import { timezone } from "@/hooks/use-study-time"
import type { StudyTimeSummary } from "@/lib/laria-api"

// Las clases guiadas del estudiante (una por tema), agrupadas por cómo van: en
// curso (la última que estudió, destacada), pendientes de una nivelación o de la
// prueba de paso, y completadas. Cada una se puede borrar tras confirmarlo
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
  const [deleting, setDeleting] = useState<LearningPath | null>(null)
  // El objetivo de hoy y la racha; sin el endpoint (backend anterior), no se muestra
  const [study, setStudy] = useState<StudyTimeSummary | null>(null)
  useEffect(() => {
    let cancelled = false
    lariaAPI.study
      .summary(timezone())
      .then((loaded) => !cancelled && setStudy(loaded))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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

  const closeDialog = useCallback(() => setDeleting(null), [])
  const removeDeleted = useCallback(() => {
    setPaths((current) => current?.filter((path) => path.id !== deleting?.id) ?? null)
    setDeleting(null)
  }, [deleting])

  const groups = paths ? classGroups(paths) : null
  const empty = groups && !groups.inProgress.length && !groups.needsPlacement.length && !groups.completed.length

  return (
    <AppShell>
      <div className="relative h-full overflow-auto">
        <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mis clases</h1>
              <p className="text-sm text-muted-foreground">Retoma donde lo dejaste o empieza un tema nuevo.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {study && <DailyProgress summary={study} />}
              {!empty && paths && (
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href={placementHref()}>
                    <Plus className="h-4 w-4" aria-hidden />
                    Nueva clase
                  </Link>
                </Button>
              )}
            </div>
          </header>

          {!paths && !error && <LoadingCards />}

          {error && (
            <div role="alert" className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <p>{error}</p>
              <Button variant="outline" onClick={load} className="gap-2">
                <RefreshCw className="h-4 w-4" aria-hidden />
                Reintentar
              </Button>
            </div>
          )}

          {empty && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
              <LariaMascot emotion="encouraging" className="w-24" />
              <div className="space-y-1.5">
                <p className="text-lg font-medium">Aún no tienes clases</p>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                  Dime qué quieres aprender: unas preguntas para saber tu nivel y te preparo una clase a tu medida, paso a paso.
                </p>
              </div>
              <Button asChild size="lg" className="gap-2">
                <Link href={placementHref()}>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Nivelarme en un tema
                </Link>
              </Button>
            </div>
          )}

          {groups && groups.inProgress.length > 0 && (
            <ClassSection title="En curso" count={groups.inProgress.length}>
              {groups.inProgress.map((path, index) => (
                <ClassCard key={path.id} path={path} featured={index === 0} onDelete={setDeleting} />
              ))}
            </ClassSection>
          )}

          {groups && groups.needsPlacement.length > 0 && (
            <ClassSection title="Pendientes" count={groups.needsPlacement.length}>
              {groups.needsPlacement.map((path) => (
                <ClassCard key={path.id} path={path} onDelete={setDeleting} />
              ))}
            </ClassSection>
          )}

          {/* Tras terminar una ruta, cómo seguir (desde la última completada) */}
          {groups && groups.completed.length > 0 && (
            <NextSuggestions pathId={groups.completed[0].id} title={`Después de ${groups.completed[0].title || groups.completed[0].topic}`} />
          )}

          {groups && groups.completed.length > 0 && (
            <ClassSection title="Completadas" count={groups.completed.length}>
              {groups.completed.map((path) => (
                <ClassCard key={path.id} path={path} onDelete={setDeleting} />
              ))}
            </ClassSection>
          )}
        </div>
      </div>

      {deleting && (
        <DeleteClassDialog pathId={deleting.id} title={nameOf(deleting)} onClose={closeDialog} onDeleted={removeDeleted} />
      )}
    </AppShell>
  )
}

const nameOf = (path: LearningPath) => path.title || path.topic || "Clase"

function LoadingCards() {
  return (
    <div role="status" className="grid gap-4 sm:grid-cols-2">
      <span className="sr-only">Cargando tus clases…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className={`space-y-4 rounded-2xl border border-border bg-card p-5 ${i === 0 ? "sm:col-span-2" : ""}`}>
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-9 w-28" />
        </div>
      ))}
    </div>
  )
}

function ClassSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{count}</span>
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">{children}</ul>
    </section>
  )
}

type ClassState = "in_progress" | "review" | "passage" | "placement" | "completed"

function classState(path: LearningPath): ClassState {
  const phase = path.teaching?.phase
  if (tierDone(path)) return "passage"
  if (phase === "assessment") return "placement"
  if (phase === "completed") return "completed"
  return path.teaching?.variant === "review" ? "review" : "in_progress"
}

// Qué toca en cada clase: el aviso y a dónde lleva el botón principal
function nextStep(path: LearningPath, state: ClassState): { note: string | null; href: string; action: string } {
  const concept = path.teaching?.concept_title
  switch (state) {
    case "passage":
      return {
        note: path.next_tier ? `Haz la prueba de paso para abrir el tramo ${LEVEL_NAME[path.next_tier]}, con clases nuevas.` : null,
        href: passageTestHref(path.id),
        action: "Hacer la prueba de paso",
      }
    case "placement":
      return { note: "Antes de empezar, unas preguntas para saber tu nivel.", href: placementHref(path.topic ?? undefined), action: "Hacer la nivelación" }
    case "completed":
      return { note: "Si hace tiempo que no la practicas, LARIA te propondrá un repaso.", href: classHref(path.id), action: "Abrir" }
    case "review":
      return { note: concept ? `Repasamos: ${concept}` : null, href: classHref(path.id), action: "Continuar" }
    default:
      return { note: concept ? `Vas por: ${concept}` : null, href: classHref(path.id), action: "Continuar" }
  }
}

const STATE_BADGE: Partial<Record<ClassState, { label: string; className: string }>> = {
  review: { label: "Repaso pendiente", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  passage: { label: "Prueba de paso disponible", className: "bg-primary/10 text-primary" },
  placement: { label: "Falta la nivelación", className: "bg-muted text-muted-foreground" },
  completed: { label: "Completada", className: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300" },
}

function ClassCard({ path, featured = false, onDelete }: { path: LearningPath; featured?: boolean; onDelete: (path: LearningPath) => void }) {
  const state = classState(path)
  const step = nextStep(path, state)
  const badge = STATE_BADGE[state]
  const name = nameOf(path)
  // Con tramos, el progreso es el del tramo en curso (el de la ruta baja al abrir uno)
  const tier = currentTier(path)
  const tierModules = tier ? path.modules.filter((m) => m.tier === tier) : path.modules
  const progress = tier ? tierProgress(path, tier) : (path.progress ?? 0)
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  const done = tierModules.filter((m) => m.status === "completed" || m.status === "assumed").length
  const when = lastStudied(path.updated_at)
  const completed = state === "completed"

  return (
    <li
      className={`flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 ${
        featured ? "border-primary/40 sm:col-span-2" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {featured && <p className="text-xs font-medium uppercase tracking-wide text-primary">Sigue donde lo dejaste</p>}
          <h3 className={`font-semibold leading-snug ${featured ? "text-xl" : "text-base"}`}>{name}</h3>
          {when && <p className="text-xs text-muted-foreground">Última vez: {when}</p>}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(path)}
          aria-label={`Borrar la clase ${name}`}
          title="Borrar la clase"
          className="-mr-1.5 -mt-1 shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {(badge || step.note) && (
        <div className="space-y-2">
          {badge && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
              {state === "review" && <RotateCcw className="h-3 w-3" aria-hidden />}
              {badge.label}
            </span>
          )}
          {step.note && <p className="text-sm">{step.note}</p>}
        </div>
      )}

      {(path.tiers?.length ?? 0) > 0 && <TierSteps opened={path.tiers ?? []} current={tier} completed={completed} />}

      {state !== "placement" && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {tierModules.length > 0 ? `${done} de ${tierModules.length} conceptos` : "Progreso"}
              {tier ? ` · tramo ${LEVEL_NAME[tier]}` : ""}
            </span>
            <span className="tabular-nums">{percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-label={`Progreso de ${name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${completed ? "bg-green-600 dark:bg-green-400" : "bg-primary"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {path.modules.length > 0 && <Syllabus path={path} />}

      <div className="mt-auto flex">
        <Button asChild size={featured ? "lg" : "default"} variant={completed ? "outline" : "default"} className="w-full gap-2 sm:w-auto">
          <Link href={step.href}>
            {step.action}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </li>
  )
}

const TIERS: PlacementLevel[] = ["basico", "intermedio", "avanzado"]

// Básico → intermedio → avanzado: los abiertos, el que se está haciendo y los que faltan
function TierSteps({ opened, current, completed }: { opened: PlacementLevel[]; current: PlacementLevel | null; completed: boolean }) {
  const label = current ? `Nivel ${LEVEL_NAME[current]}, ${TIERS.indexOf(current) + 1} de 3` : "Nivel"
  return (
    <ol aria-label={label} className="flex items-center gap-1.5">
      {TIERS.map((tier, i) => {
        const isOpen = opened.includes(tier)
        const isCurrent = tier === current && !completed
        return (
          <li key={tier} className="flex flex-1 items-center gap-1.5">
            <span
              className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isOpen
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isOpen && !isCurrent ? <Check className="h-3 w-3 shrink-0" aria-hidden /> : !isOpen ? <Lock className="h-3 w-3 shrink-0" aria-hidden /> : null}
              <span className="truncate capitalize">{LEVEL_NAME[tier]}</span>
              <span className="sr-only">{isCurrent ? " (en curso)" : isOpen ? " (abierto)" : " (sin abrir)"}</span>
            </span>
            {i < TIERS.length - 1 && <span className="h-px w-2 shrink-0 bg-border" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

function ModuleIcon({ status }: { status: PathModule["status"] }) {
  if (status === "completed" || status === "assumed") return <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" aria-hidden />
  if (status === "in_progress") return <CircleDot className="h-3.5 w-3.5 text-primary" aria-hidden />
  if (status === "locked") return <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />
  return <Circle className="h-3 w-3 text-muted-foreground" aria-hidden />
}

// El temario, al desplegar: cada concepto con su estado y cuánto se domina (en
// palabras y una barrita, nunca como nota)
function Syllabus({ path }: { path: LearningPath }) {
  const modules = [...path.modules].sort((a, b) => a.position - b.position)
  return (
    <details className="group rounded-xl bg-muted/40 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        Ver temario ({modules.length})
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ol className="mt-2 space-y-1.5 pb-1">
        {modules.map((module) => {
          const steps = masterySteps(module)
          return (
            <li key={module.concept} className="flex items-center gap-2 text-sm">
              <span className="flex w-4 shrink-0 justify-center">
                <ModuleIcon status={module.status} />
              </span>
              <span className={`min-w-0 flex-1 truncate ${module.status === "locked" ? "text-muted-foreground" : ""}`}>{module.title}</span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className="flex gap-0.5" aria-hidden>
                  {[1, 2, 3].map((n) => (
                    <span key={n} className={`h-1.5 w-2.5 rounded-full ${n <= steps ? "bg-primary" : "bg-border"}`} />
                  ))}
                </span>
                {moduleLabel(module)}
              </span>
            </li>
          )
        })}
      </ol>
    </details>
  )
}
