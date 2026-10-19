import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { clerkLocalization } from "@/lib/clerk-localization"

type AuthForm = "sign-in" | "sign-up"

const FORMS = {
  "sign-in": { ...clerkLocalization.signIn.start, loading: "Cargando el formulario para entrar", fields: 1 },
  "sign-up": { ...clerkLocalization.signUp.start, loading: "Cargando el formulario para crear tu cuenta", fields: 3 },
} satisfies Record<AuthForm, { title: string; subtitle: string; loading: string; fields: number }>

// Hueco del formulario de Clerk. El formulario no existe hasta que bajan el script
// de Clerk, su configuración y su interfaz (en un móvil lento, segundos); mientras,
// el servidor ya pinta una tarjeta con su misma forma y medidas. Cuando Clerk monta
// la suya (.cl-cardBox, que llega ~60 ms antes que la clase .cl-rootBox de su
// contenedor), la del esqueleto se oculta solo con CSS: no depende de
// cuándo carga cada pieza ni de ningún evento de Clerk
export function ClerkSlot({ form, children }: { form: AuthForm; children: ReactNode }) {
  return (
    <div className="group/clerk flex w-full flex-col items-center">
      {children}
      <div className="group-has-[:is(.cl-rootBox,.cl-cardBox)]/clerk:hidden">
        <AuthCardSkeleton form={form} />
      </div>
    </div>
  )
}

// Medidas copiadas de la tarjeta de Clerk (tema shadcn): 25rem de ancho, relleno
// de 32/40 px, controles de 32 px, campos separados 24 px. Los botones de Google y
// Microsoft se apilan en pantallas estrechas, como en Clerk
function AuthCardSkeleton({ form }: { form: AuthForm }) {
  const { title, subtitle, loading, fields } = FORMS[form]
  return (
    <div
      role="status"
      className="w-[min(25rem,calc(100vw-2.5rem))] overflow-hidden rounded-xl bg-muted shadow-[0_5px_15px_0_rgb(0_0_0/0.08),0_15px_35px_-5px_rgb(25_28_33/0.2)]"
    >
      <span className="sr-only">{loading}</span>
      <div aria-hidden className="relative z-10 -mx-px rounded-lg bg-card px-10 py-8 shadow-[0_0_2px_0_rgb(0_0_0/0.08),0_1px_2px_0_rgb(25_28_33/0.12)]">
        <div className="text-center">
          <p className="text-[17px] font-bold leading-6">{title}</p>
          <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">{subtitle}</p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-2 max-[30rem]:grid-cols-1">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
        <div className="my-6 flex h-[18px] items-center">
          <div className="h-px w-full bg-border" />
        </div>
        <div className="space-y-6">
          {Array.from({ length: fields }, (_, i) => (
            <div key={i}>
              <Skeleton className="h-[18px] w-40" />
              <Skeleton className="mt-2 h-8" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-8 h-8 bg-primary/70" />
      </div>
      {/* Pie: «¿No tienes cuenta?…» y «Secured by Clerk». Los últimos 27 px son la
          franja «Development mode», que solo sale con la instancia de desarrollo:
          quitarlos al pasar a producción */}
      <div aria-hidden className="flex h-[127px] flex-col items-center pt-4">
        <Skeleton className="h-[18px] w-48 bg-foreground/10" />
        <Skeleton className="mt-8 h-[18px] w-28 bg-foreground/10" />
      </div>
    </div>
  )
}
