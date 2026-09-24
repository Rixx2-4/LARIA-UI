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
  // El usuario dice algo y el navegador lo da por definitivo
  say(transcript: string) {
    this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript }, isFinal: true }] })
  }
}
