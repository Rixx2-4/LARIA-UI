import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json() as { messages: ChatMessage[] }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const fullMessages: ChatMessage[] = [
      {
        role: "system",
        content: "You are LARIA, a helpful AI assistant. Respond in the same language the user uses. Be concise and helpful. Remember the context of the conversation.",
      },
      ...messages,
    ]

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: fullMessages,
      max_tokens: 1000,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || "No response generated."

    return NextResponse.json({ response })
  } catch (error) {
    console.error("OpenAI API error:", error)
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 })
  }
}