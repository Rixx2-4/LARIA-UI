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
  stop() {
    this.listening = false
    this.onend?.()
  }
  // El usuario dice algo y el navegador lo da por definitivo
  say(transcript: string) {
    this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript }, isFinal: true }] })
  }
}
