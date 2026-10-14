import type { Metadata } from "next"
import { SignIn } from "@/app/components/clerk-ui"
import { AuthPage } from "@/app/components/auth-page"

export const metadata: Metadata = { title: "Entrar" }

export default function SignInPage() {
  return (
    <AuthPage>
      <SignIn />
    </AuthPage>
  )
}
