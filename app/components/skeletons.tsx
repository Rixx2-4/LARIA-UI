import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"

// Siluetas de lo que está por llegar: ocupan el mismo sitio que el contenido real
// para que la página no salte al cargar. El texto solo lo oyen los lectores de pantalla.

function Loading({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-label={label} className={className}>
      {children}
      <span className="sr-only">{label}</span>
    </div>
  )
}

// La estructura de la app mientras se comprueba la sesión
export function AppShellSkeleton() {
  return (
    <Loading label="Cargando" className="flex h-dvh w-full overflow-hidden bg-background">
      <div className="hidden w-[72px] shrink-0 flex-col items-center gap-6 border-r border-border py-4 md:flex">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="mb-2 h-10 w-10 rounded-full" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-10 rounded-lg" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2 md:px-6 md:py-3">
          {/* Como la cabecera real: sin el nombre de la app (va en la barra lateral desplegada) */}
          <div />
          <Skeleton className="h-4 w-24" />
        </header>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-end px-4 pb-6">
          <Skeleton className="h-[104px] w-full max-w-3xl rounded-2xl" />
        </div>
      </div>
    </Loading>
  )
}

const CHAT_ROW_WIDTHS = ["w-4/5", "w-3/5", "w-11/12", "w-2/3", "w-3/4"]

export function ChatListSkeleton() {
  return (
    <Loading label="Cargando tus chats" className="space-y-1 px-2 py-1">
      {CHAT_ROW_WIDTHS.map((width) => (
        <div key={width} className="py-1.5">
          <Skeleton className={`h-4 ${width}`} />
        </div>
      ))}
    </Loading>
  )
}

export function DocumentListSkeleton() {
  return (
    <Loading label="Cargando tus documentos" className="space-y-1 px-2 py-1">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-center gap-2.5 py-2">
          <Skeleton className="h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </Loading>
  )
}

// Burbujas alternadas con la forma de una conversación
export function MessagesSkeleton() {
  return (
    <Loading label="Cargando la conversación" className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:px-6">
      <div className="flex justify-end">
        <Skeleton className="h-11 w-2/5 rounded-2xl" />
      </div>
      <div className="flex justify-start">
        <div className="w-3/4 space-y-2.5 rounded-2xl bg-muted/60 px-4 py-4">
          <Skeleton className="h-3.5 w-full bg-foreground/10" />
          <Skeleton className="h-3.5 w-11/12 bg-foreground/10" />
          <Skeleton className="h-3.5 w-2/3 bg-foreground/10" />
        </div>
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-11 w-1/3 rounded-2xl" />
      </div>
      <div className="flex justify-start">
        <div className="w-2/3 space-y-2.5 rounded-2xl bg-muted/60 px-4 py-4">
          <Skeleton className="h-3.5 w-full bg-foreground/10" />
          <Skeleton className="h-3.5 w-4/5 bg-foreground/10" />
        </div>
      </div>
    </Loading>
  )
}

function CardSkeleton({ className, lines = 2 }: { className?: string; lines?: number }) {
  return (
    <div className={`rounded-xl border border-border p-4 ${className ?? ""}`}>
      <Skeleton className="mb-2 h-4 w-1/3" />
      <Skeleton className="mb-4 h-3 w-1/2" />
      <div className="space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={`h-3 ${i % 2 ? "w-4/5" : "w-full"}`} />
        ))}
      </div>
    </div>
  )
}

// Misma rejilla que la página de perfil: cabecera, aviso y tarjetas
export function ProfileSkeleton() {
  return (
    <Loading label="Cargando tu perfil" className="h-full overflow-hidden">
      <div className="mx-auto max-w-[980px]">
        <div className="flex items-center gap-4 px-6 py-5">
          <Skeleton className="h-[52px] w-[52px] shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-52" />
            <div className="flex flex-wrap gap-2.5">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-36 rounded-full" />
            </div>
          </div>
        </div>
        <div className="space-y-4 px-4 md:px-6">
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-28 w-28 rounded-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <CardSkeleton lines={4} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <CardSkeleton lines={2} />
        </div>
      </div>
    </Loading>
  )
}

// Un selector aún vacío, del mismo alto que el real
export function SelectSkeleton({ label }: { label: string }) {
  return (
    <Loading label={label}>
      <Skeleton className="h-[38px] w-full rounded-lg" />
    </Loading>
  )
}

export function FilePreviewSkeleton() {
  return (
    <Loading label="Cargando el archivo" className="flex h-full flex-col gap-3 p-6">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="mt-2 min-h-0 w-full flex-1 rounded-lg" />
    </Loading>
  )
}
