import type { Metadata } from "next"
import { SignUp } from "@/app/components/clerk-ui"
import { AuthPage } from "@/app/components/auth-page"
import { ClerkSlot } from "@/app/components/clerk-slot"

export const metadata: Metadata = { title: "Crear cuenta" }

export default function SignUpPage() {
  return (
    <AuthPage>
      <ClerkSlot form="sign-up">
        <SignUp />
      </ClerkSlot>
    </AuthPage>
  )
}
