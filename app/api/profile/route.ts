import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

interface QuizAttempt {
  fecha: string
  tema: string
  aciertos: number
  total: number
  tiempoProm: string
  fallados: string[]
}

interface ProfileData {
  nombre: string
  nivel: string
  ritmo: number
  intentos: QuizAttempt[]
  mastery: { concepto: string; valor: number }[]
}

export async function POST(request: NextRequest) {
  try {
    const { profileData } = await request.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const prompt = `Based on this student profile data, generate:
1. A list of 2-3 struggle signals (patterns indicating recent difficulty)
2. A list of 2-3 strengths (what's working well)
3. A list of 2-3 recommendations for LARIA to suggest

Student data:
- Name: ${profileData.nombre}
- Level: ${profileData.nivel}
- Pace: ${profileData.ritmo}%
- Recent quiz attempts: ${JSON.stringify(profileData.intentos)}
- Mastery by concept: ${JSON.stringify(profileData.mastery)}

Return ONLY a JSON object with this structure, no other text:
{
  "struggle": [{ "concepto": "topic", "detalle": "description", "fecha": "when" }],
  "fortalezas": [{ "texto": "strength description" }],
  "recomendaciones": ["recommendation 1", "recommendation 2"]
}`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an educational AI assistant that analyzes student data and provides insights. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 800,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || "{}"
    
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { struggle: [], fortalezas: [], recomendaciones: [] }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error("OpenAI API error:", error)
    return NextResponse.json({ error: "Failed to generate profile insights" }, { status: 500 })
  }
}