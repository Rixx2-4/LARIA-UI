"use client"

import type { ReactNode } from "react"
import { LazyMotion, MotionConfig, domAnimation, m } from "motion/react"

// Motion con carga diferida (solo las animaciones de DOM) y respetando
// "reducir movimiento": sin desplazamientos, solo fundidos
export function LandingMotion({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
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
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  )
}

// Una palabra marcada con subrayador: el trazo se pinta de izquierda a derecha
export function Marker({ children, delay = 0.5 }: { children: ReactNode; delay?: number }) {
  return (
    <span className="relative isolate inline-block whitespace-nowrap px-1">
      <m.span
        aria-hidden
        className="absolute inset-x-0 bottom-[0.08em] top-[0.18em] -z-10 origin-left -rotate-1 rounded-[3px] bg-marker"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay, ease: [0.65, 0, 0.35, 1] }}
      />
      {children}
    </span>
  )
}
