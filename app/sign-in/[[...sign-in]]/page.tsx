import type { Metadata } from "next"
import { SignIn } from "@/app/components/clerk-ui"
import { AuthPage } from "@/app/components/auth-page"
import { ClerkSlot } from "@/app/components/clerk-slot"

export const metadata: Metadata = { title: "Entrar" }

export default function SignInPage() {
  return (
    <AuthPage>
      <ClerkSlot form="sign-in">
        <SignIn />
      </ClerkSlot>
    </AuthPage>
  )
}
