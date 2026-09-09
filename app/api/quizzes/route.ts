import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

interface QuizQuestion {
  text: string
  options: Record<string, string>
  correct_answer: string
  difficulty: "easy" | "medium" | "hard"
  concept_tags: string[]
  type: "multiple" | "open"
}

export async function POST(request: NextRequest) {
  try {
    const { topic, count, chatHistory, difficulty } = await request.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const prompt = `Generate a quiz with ${count} questions about: ${topic || "the following conversation"}

${chatHistory ? `Chat history:\n${chatHistory}` : ""}

Requirements:
- Mix of multiple choice (4 options) and open-ended questions
- Difficulty level: ${difficulty || "adaptive"} (if adaptive, mix easy, medium, and hard)
- Include concept tags for each question
- Questions should be educational and test understanding

Return ONLY a JSON array with this structure, no other text:
[
  {
    "text": "Question text",
    "options": { "A": "Option 1", "B": "Option 2", "C": "Option 3", "D": "Option 4" },
    "correct_answer": "A",
    "difficulty": "easy|medium|hard",
    "concept_tags": ["tag1", "tag2"],
    "type": "multiple|open"
  }
]

For open-ended questions, set options to {} and correct_answer to the expected answer.`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an educational AI that generates quizzes. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.8,
    })

    const response = completion.choices[0]?.message?.content || "[]"
    
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    const questions: QuizQuestion[] = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    return NextResponse.json({ questions })
  } catch (error) {
    console.error("OpenAI API error:", error)
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 })
  }
}