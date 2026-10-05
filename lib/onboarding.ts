// «Ver el tutorial de nuevo» (menú de cuenta) lo pide aquí; lo muestra
// OnboardingTour, que está montado en toda la app. Solo en el cliente: volver a
// verlo no cambia nada en el backend
const listeners = new Set<() => void>()

export function replayOnboarding() {
  listeners.forEach((listener) => listener())
}

export function onReplayOnboarding(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
