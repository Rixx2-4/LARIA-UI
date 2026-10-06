// Simula el reconocimiento de voz del navegador (Web Speech API), que jsdom no tiene
export class FakeSpeechRecognition {
  static instances: FakeSpeechRecognition[] = []
  lang = ""
  continuous = false
  interimResults = false
  listening = false
  onresult: ((event: { resultIndex: number; results: { 0: { transcript: string }; isFinal: boolean }[] }) => void) | null = null
  onend: (() => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null

  constructor() {
    FakeSpeechRecognition.instances.push(this)
  }
  start() {
    this.listening = true
  }
  // Como en Chrome: stop() aún entrega lo que estuviera pendiente y avisa del final después
  stop() {
    this.listening = false
  }
  abort() {
    this.listening = false
    this.aborted = true
  }
  aborted = false
  // El navegador termina la sesión (tras stop(), abort() o un silencio)
  end() {
    this.onend?.()
  }
  // Como el navegador: cada evento trae TODOS los resultados de la sesión
  results: { 0: { transcript: string }; isFinal: boolean }[] = []
  private emit(changedAt: number) {
    this.onresult?.({ resultIndex: changedAt, results: [...this.results] })
  }
  // El usuario dice algo y el navegador lo da por definitivo
  say(transcript: string) {
    const last = this.results.at(-1)
    if (last && !last.isFinal) this.results.pop()
    this.results.push({ 0: { transcript }, isFinal: true })
    this.emit(this.results.length - 1)
  }
  // Chrome en Android: entrega una lista de resultados tal cual (repetidos, acumulados…)
  raw(results: { transcript: string; isFinal: boolean }[]) {
    this.results = results.map(({ transcript, isFinal }) => ({ 0: { transcript }, isFinal }))
    this.emit(0)
  }
  // El navegador falla (p. ej. "network" en Brave o Chromium, sin servicio de dictado)
  fail(error: string) {
    this.onerror?.({ error })
    this.listening = false
    this.onend?.()
  }
  // Lo que el navegador va entendiendo mientras la frase no ha terminado
  sayInterim(transcript: string) {
    const last = this.results.at(-1)
    if (last && !last.isFinal) this.results.pop()
    this.results.push({ 0: { transcript }, isFinal: false })
    this.emit(this.results.length - 1)
  }
}
