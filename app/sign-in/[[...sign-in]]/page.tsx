import type { Metadata } from "next"
import { SignIn } from "@clerk/nextjs"
import { AuthPage } from "@/app/components/auth-page"

export const metadata: Metadata = { title: "Entrar" }

export default function SignInPage() {
  return (
    <AuthPage>
      <SignIn />
    </AuthPage>
  )
}
