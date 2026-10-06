"use client"

import { useEffect, type RefObject } from "react"

// Campos donde la tecla ya escribe algo: ahí no se toca el foco
function isEditable(el: Element | null) {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  return el.matches("input, textarea, select")
}

// Empezar a escribir desde cualquier parte de la página lleva el foco al campo:
// la tecla que lo provoca acaba ya dentro, porque el foco cambia antes de que se escriba
export function useTypeToFocus(ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e: KeyboardEvent) => {
      const field = ref.current
      if (!field || field.disabled || e.defaultPrevented || e.isComposing) return
      // Solo teclas que escriben un carácter; los atajos (Ctrl, Cmd, Alt) se quedan como están
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return

      const target = e.target instanceof Element ? e.target : document.activeElement
      if (target === field || isEditable(target)) return
      // Dentro de un diálogo (menús, visores) las teclas son suyas
      if (target?.closest('[role="dialog"], [aria-modal="true"]')) return
      // Con un modal abierto (el tutorial) el chat queda detrás, aunque el foco no esté en él
      if (document.querySelector('[aria-modal="true"]')) return
      // El espacio sobre un botón o enlace lo pulsa: no es escribir
      if (e.key === " " && target && target !== document.body) return

      field.focus()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [ref, enabled])
}
