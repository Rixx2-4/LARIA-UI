import { NextRequest, NextResponse } from "next/server"

interface QuizAttempt {
  id: string
  quiz_id: string
  student_id: string
  answers: Record<number, string>
  per_question_correct: boolean[]
  score: number
  total_points: number
  completed_at: string
}

export async function POST(request: NextRequest) {
  try {
    const { quiz_id, student_id, answers, questions } = await request.json()

    const perQuestionCorrect: boolean[] = []
    let score = 0

    questions.forEach((q: { correct_answer: string }, index: number) => {
      const userAnswer = answers[index]
      const isCorrect = userAnswer === q.correct_answer
      perQuestionCorrect.push(isCorrect)
      if (isCorrect) score++
    })

    const attempt: QuizAttempt = {
      id: crypto.randomUUID(),
      quiz_id,
      student_id: student_id || "anonymous",
      answers,
      per_question_correct: perQuestionCorrect,
      score,
      total_points: questions.length,
      completed_at: new Date().toISOString(),
    }

    const existingAttempts = JSON.parse(localStorage.getItem("laria_quiz_attempts") || "[]")
    existingAttempts.push(attempt)
    localStorage.setItem("laria_quiz_attempts", JSON.stringify(existingAttempts))

    return NextResponse.json({ attempt })
  } catch (error) {
    console.error("Failed to save quiz attempt:", error)
    return NextResponse.json({ error: "Failed to save attempt" }, { status: 500 })
  }
}