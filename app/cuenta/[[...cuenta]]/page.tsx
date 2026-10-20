"use client"

import { DeleteAccount, UserProfile } from "@/app/components/clerk-ui"
import { RequireAuth } from "@/app/components/require-auth"
import { AppShell } from "@/app/components/app-shell"
import { LegalLinks } from "@/app/components/legal-links"

// La cuenta (correo, contraseña, Google, sesiones abiertas) la gestiona Clerk
export default function CuentaPage() {
  return (
    <RequireAuth>
      <AppShell>
        <div className="flex h-full flex-col items-center gap-6 overflow-auto px-2 py-6 sm:px-6">
          <UserProfile path="/cuenta" />
          <DeleteAccount />
          <LegalLinks />
        </div>
      </AppShell>
    </RequireAuth>
  )
}
