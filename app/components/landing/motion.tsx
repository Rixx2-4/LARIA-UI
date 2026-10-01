"use client"

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { LazyMotion, MotionConfig, domAnimation, m, useReducedMotion } from "motion/react"

// Motion con carga diferida (solo las animaciones de DOM) y respetando
// "reducir movimiento": sin desplazamientos, solo fundidos
export function LandingMotion({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}

const EASE = [0.22, 1, 0.36, 1] as const
// Lo que entra por debajo de este margen aún no cuenta como "a la vista"
const BOTTOM_MARGIN = 80

// "static": se ve tal cual (lo que sale del servidor, sin JS o con "reducir movimiento");
// "hidden": fuera de pantalla, esperando a entrar; "shown": ya entró y se animó
type RevealState = "static" | "hidden" | "shown"

// El contenido sale VISIBLE del servidor. Solo tras hidratar, y solo si el bloque
// está por debajo de la pantalla, se esconde para animarlo cuando el usuario llegue.
// Así nunca hay huecos: ni sin JS, ni con JS lento, ni al imprimir, ni con
// "reducir movimiento", y lo que ya está a la vista no parpadea
function useRevealOnScroll(ref: RefObject<HTMLElement | null>): RevealState {
  const reduceMotion = useReducedMotion()
  const [state, setState] = useState<RevealState>("static")

  useEffect(() => {
    const el = ref.current
    if (!el || reduceMotion || typeof IntersectionObserver === "undefined") return
    if (el.getBoundingClientRect().top < window.innerHeight - BOTTOM_MARGIN) return

    setState("hidden")
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setState("shown")
        observer.disconnect()
      },
      { rootMargin: `0px 0px -${BOTTOM_MARGIN}px 0px` },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, reduceMotion])

  return state
}

// Aparece al entrar en pantalla, una sola vez
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const state = useRevealOnScroll(ref)

  return (
    <m.div
      ref={ref}
      // Al imprimir se ve todo, aunque el usuario no haya bajado hasta ahí
      className={`print:!transform-none print:!opacity-100 ${className ?? ""}`}
      initial={false}
      animate={state === "hidden" ? { opacity: 0, y: 24 } : { opacity: 1, y: 0 }}
      transition={state === "shown" ? { duration: 0.6, delay, ease: EASE } : { duration: 0 }}
    >
      {children}
    </m.div>
  )
}

// Una palabra marcada con subrayador: el trazo se pinta de izquierda a derecha
// cuando la palabra entra en pantalla (si ya estaba a la vista, sale pintado)
export function Marker({ children, delay = 0.5 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const state = useRevealOnScroll(ref)

  return (
    <span ref={ref} className="relative isolate inline-block whitespace-nowrap px-1">
      <m.span
        aria-hidden
        className="absolute inset-x-0 bottom-[0.08em] top-[0.18em] -z-10 origin-left -rotate-1 rounded-[3px] bg-marker print:!transform-none"
        initial={false}
        animate={{ scaleX: state === "hidden" ? 0 : 1 }}
        transition={state === "shown" ? { duration: 0.7, delay, ease: [0.65, 0, 0.35, 1] } : { duration: 0 }}
      />
      {children}
    </span>
  )
}
