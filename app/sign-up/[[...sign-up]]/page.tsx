import type { Metadata } from "next"
import { SignUp } from "@/app/components/clerk-ui"
import { AuthPage } from "@/app/components/auth-page"

export const metadata: Metadata = { title: "Crear cuenta" }

export default function SignUpPage() {
  return (
    <AuthPage>
      <SignUp />
    </AuthPage>
  )
}
