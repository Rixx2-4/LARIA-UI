"use client"

import type { ReactNode } from "react"
import { RequireAuth } from "../components/require-auth"
import { ChatScreen } from "../components/chat-screen"

// "/chat" y "/chat/[id]" comparten este layout: cambiar la URL al crear un chat
// no desmonta la pantalla ni corta la respuesta en curso
export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <ChatScreen />
      {children}
    </RequireAuth>
  )
}
