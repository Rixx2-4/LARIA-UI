import { NextRequest, NextResponse } from "next/server"

interface Chat {
  id: string
  title: string
  messages: { role: string; content: string }[]
  created_at: string
  updated_at: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const chats = JSON.parse(localStorage.getItem("laria_chats") || "[]")
    const chat = chats.find((c: Chat) => c.id === id)

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    return NextResponse.json({ chat })
  } catch (error) {
    console.error("Failed to get chat:", error)
    return NextResponse.json({ error: "Failed to get chat" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { title, messages } = await request.json()

    const chats = JSON.parse(localStorage.getItem("laria_chats") || "[]")
    const chatIndex = chats.findIndex((c: Chat) => c.id === id)

    if (chatIndex === -1) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    chats[chatIndex] = {
      ...chats[chatIndex],
      title: title || chats[chatIndex].title,
      messages: messages || chats[chatIndex].messages,
      updated_at: new Date().toISOString(),
    }

    localStorage.setItem("laria_chats", JSON.stringify(chats))

    return NextResponse.json({ chat: chats[chatIndex] })
  } catch (error) {
    console.error("Failed to update chat:", error)
    return NextResponse.json({ error: "Failed to update chat" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const chats = JSON.parse(localStorage.getItem("laria_chats") || "[]")
    const filteredChats = chats.filter((c: Chat) => c.id !== id)

    if (filteredChats.length === chats.length) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    localStorage.setItem("laria_chats", JSON.stringify(filteredChats))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete chat:", error)
    return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 })
  }
}