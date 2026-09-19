"use client"

import { FormEvent, useState } from "react"
import { Loader2, ArrowRight } from "lucide-react"
import { useAuth } from "@/app/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function LoginScreen() {
  const { login, register } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
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
    <main className="flex min-h-screen w-full items-center justify-center bg-background px-6 py-12">
      <section className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-5">
          <div className="flex items-center gap-1.5">
            <span className="text-3xl font-bold tracking-tight text-foreground">LARIA</span>
            <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">IA</span>
          </div>
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
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" minLength={8} required className="h-11 rounded-xl border-0 bg-muted/50 shadow-none" />
            </label>
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

