"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { Loader2, ArrowRight, Check, Circle, X } from "lucide-react"
import { useAuth } from "@/app/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// Las mismas reglas que exige el backend al registrarse
const PASSWORD_RULES = [
  { label: "Al menos 12 caracteres", test: (p: string) => p.length >= 12 },
  { label: "Una mayúscula", test: (p: string) => /\p{Lu}/u.test(p) },
  { label: "Una minúscula", test: (p: string) => /\p{Ll}/u.test(p) },
  { label: "Un número", test: (p: string) => /\d/.test(p) },
]

export function LoginScreen() {
  const { login, register } = useAuth()
  // "Crear cuenta" en la página de presentación llega con ?modo=registro.
  // Esta pantalla solo se pinta en el navegador (antes va el skeleton de sesión)
  const [isLogin, setIsLogin] = useState(
    () => typeof window === "undefined" || new URLSearchParams(window.location.search).get("modo") !== "registro",
  )
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    if (!isLogin && !PASSWORD_RULES.every((rule) => rule.test(password))) {
      setError("La contraseña no cumple todos los requisitos.")
      return
    }
    setIsLoading(true)

    try {
      if (isLogin) await login(email, password)
      else await register(username, email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la operación")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center bg-background px-6 py-12">
      {/* Salir sin entrar: de vuelta a la página de presentación */}
      {/* Bien visible: botón con borde y, desde tablet, con texto; en móvil solo la X (44 px) */}
      <Link
        href="/"
        aria-label="Cerrar y volver a la página de inicio"
        className="absolute right-3 top-3 z-10 flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent sm:right-6 sm:top-6 sm:px-4"
      >
        <X className="h-5 w-5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Volver al inicio</span>
      </Link>
      <section className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-5">
          <Link href="/" aria-label="LARIA, página de inicio" className="flex items-center gap-1.5">
            <span className="text-3xl font-bold tracking-tight text-foreground">LARIA</span>
            <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">IA</span>
          </Link>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {isLogin ? "Bienvenido de nuevo" : "Crea tu cuenta"}
            </h1>
            <p className="text-sm text-muted-foreground">Tu espacio inteligente para aprender y explorar.</p>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-border/60 bg-background/80 p-6 shadow-[0_2px_10px_rgb(0,0,0,0.04)] backdrop-blur-sm sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 text-left">
            {!isLogin && (
              <label className="flex flex-col gap-2 text-sm font-medium">
                Usuario
                <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Tu nombre de usuario" required className="h-11 rounded-xl border-0 bg-muted/50 shadow-none" />
              </label>
            )}
            <label className="flex flex-col gap-2 text-sm font-medium">
              Email
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" required className="h-11 rounded-xl border-0 bg-muted/50 shadow-none" />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Contraseña
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isLogin ? "Tu contraseña" : "Mínimo 12 caracteres"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                aria-describedby={isLogin ? undefined : "password-rules"}
                required
                className="h-11 rounded-xl border-0 bg-muted/50 shadow-none"
              />
            </label>
            {!isLogin && (
              <ul id="password-rules" className="-mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(password)
                  return (
                    <li key={rule.label} className={`flex items-center gap-1.5 transition-colors ${met ? "text-foreground" : "text-muted-foreground"}`}>
                      {met ? <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" /> : <Circle className="h-3 w-3" />}
                      {rule.label}
                      <span className="sr-only">{met ? "(cumplido)" : "(pendiente)"}</span>
                    </li>
                  )
                })}
              </ul>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={isLoading} className="h-11 rounded-full transition-all duration-200">
              {isLoading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <ArrowRight data-icon="inline-end" />}
              {isLogin ? "Iniciar sesión" : "Crear cuenta"}
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground">
            {isLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
            <button type="button" onClick={() => { setIsLogin(!isLogin); setError("") }} className="font-medium text-foreground underline-offset-4 transition-all duration-200 hover:underline">
              {isLogin ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}

export default LoginScreen

