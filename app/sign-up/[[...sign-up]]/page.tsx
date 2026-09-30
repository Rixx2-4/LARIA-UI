import type { Metadata } from "next"
import { SignUp } from "@clerk/nextjs"
import { AuthPage } from "@/app/components/auth-page"

export const metadata: Metadata = { title: "Crear cuenta" }

export default function SignUpPage() {
  return (
    <AuthPage>
      <SignUp />
    </AuthPage>
  )
}
