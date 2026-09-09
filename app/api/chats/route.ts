import { NextRequest, NextResponse } from "next/server"

interface Chat {
  id: string
  title: string
  messages: { role: string; content: string }[]
  created_at: string
  updated_at: string
}

export async function GET() {
  try {
    const chats = JSON.parse(localStorage.getItem("laria_chats") || "[]")
    return NextResponse.json({ chats })
  } catch (error) {
    console.error("Failed to get chats:", error)
    return NextResponse.json({ error: "Failed to get chats" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, messages } = await request.json()

    const chat: Chat = {
      id: crypto.randomUUID(),
      title: title || "Nuevo chat",
      messages: messages || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const existingChats = JSON.parse(localStorage.getItem("laria_chats") || "[]")
    existingChats.push(chat)
    localStorage.setItem("laria_chats", JSON.stringify(existingChats))

    return NextResponse.json({ chat })
  } catch (error) {
    console.error("Failed to create chat:", error)
    return NextResponse.json({ error: "Failed to create chat" }, { status: 500 })
  }
}