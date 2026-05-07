import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { PLAN_DAYS, TASK_TYPES, type EnglishLevel, type GeneratedPlan, type PlanType } from '../types'

export function buildGeminiPrompt(currentLevel: EnglishLevel, totalDays: number) {
  return `You are an expert English curriculum designer for Brazilian Portuguese speakers.

Create an intensive English study plan as STRICT JSON only. Do not include markdown, comments, explanations, or trailing commas.

Student level: ${currentLevel}
Plan length in days: ${totalDays}

Generate exactly ${totalDays} day objects. Each day must contain 10 tasks with a balanced mix:
- 4 LISTENING tasks
- 3 PRONUNCIATION tasks
- 3 BUILDING tasks

The plan must teach practical real-life English using high-frequency situations: introductions, work, travel, food, routines, opinions, problems, requests, scheduling, and small talk.

Difficulty rule:
- Use the student's current level as the base.
- Include some i+1 challenge, especially in PRONUNCIATION tasks.
- Keep sentences useful, natural, and short enough for daily practice.

Return this exact JSON shape:
{
  "days": [
    {
      "day": 1,
      "theme": "string",
      "tasks": [
        {
          "type": "LISTENING",
          "content": "Text to be spoken with text-to-speech. The user will hear it.",
          "prompt": "What the user must do after listening.",
          "expectedAnswer": "Expected typed answer or short answer.",
          "words": [],
          "hints": ["short helpful hint in Portuguese"],
          "translation": "Brazilian Portuguese translation of the main English phrase",
          "sentenceParts": ["optional visible fragments or blanks"]
        },
        {
          "type": "PRONUNCIATION",
          "content": "Instruction for the user.",
          "prompt": "Read this sentence aloud.",
          "expectedAnswer": "The exact English sentence the user should say.",
          "words": [],
          "hints": ["pronunciation or meaning hint in Portuguese"],
          "translation": "Brazilian Portuguese translation of the sentence",
          "sentenceParts": ["optional phrase chunks for rhythm"]
        },
        {
          "type": "BUILDING",
          "content": "Portuguese meaning or short situation.",
          "prompt": "Build the sentence with the chips.",
          "expectedAnswer": "Correct English sentence.",
          "words": ["shuffled", "word", "chips"],
          "hints": ["grammar or word order hint in Portuguese"],
          "translation": "Brazilian Portuguese translation of the answer",
          "sentenceParts": ["I", "____", "coffee", "every morning"]
        }
      ]
    }
  ]
}

Rules:
- All expectedAnswer values must be in English.
- BUILDING words must contain every word needed to form expectedAnswer, shuffled.
- LISTENING content must be in English and suitable for speech synthesis.
- Every task must include 1 to 3 didactic hints in Brazilian Portuguese.
- Every task must include translation in Brazilian Portuguese.
- sentenceParts must help the student complete, chunk, and pronounce the answer. Include useful fragments, blanks, or syllable-like rhythm chunks.
- Hints should explain how to say the answer naturally, including pronunciation notes when useful.
- Avoid offensive, adult, political, medical, or legally sensitive content.
- Keep JSON valid and parseable by JSON.parse.`
}

export async function generateIntensivePlan(uid: string, currentLevel: EnglishLevel, planType: PlanType) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Configure VITE_GEMINI_API_KEY para gerar o plano.')
  }

  const totalDays = PLAN_DAYS[planType]
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: import.meta.env.VITE_GEMINI_MODEL ?? 'gemini-flash-latest',
    generationConfig: { responseMimeType: 'application/json' },
  })

  const response = await model.generateContent(buildGeminiPrompt(currentLevel, totalDays))
  const plan = parseGeneratedPlan(response.response.text(), totalDays)

  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', uid)
    const userSnapshot = await transaction.get(userRef)

    if (!userSnapshot.exists()) {
      throw new Error('Usuario nao encontrado.')
    }

    const activePlan = userSnapshot.data().activePlan as PlanType | null
    if (activePlan !== null) {
      throw new Error('Voce ja possui um plano ativo.')
    }

    const planRef = doc(db, 'users', uid, 'studyPlan', 'current')
    transaction.set(planRef, {
      uid,
      activePlan: planType,
      totalDays,
      completedDays: [],
      currentDay: 1,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    transaction.update(userRef, {
      activePlan: planType,
      planStartDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })

  await saveGeneratedTasks(uid, plan)
}

function parseGeneratedPlan(rawText: string, totalDays: number): GeneratedPlan {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  const parsed = JSON.parse(cleaned) as GeneratedPlan

  if (!Array.isArray(parsed.days) || parsed.days.length !== totalDays) {
    throw new Error('A resposta da IA nao trouxe a quantidade esperada de dias.')
  }

  parsed.days.forEach((day) => {
    if (!Number.isInteger(day.day) || !day.theme || !Array.isArray(day.tasks)) {
      throw new Error('A resposta da IA trouxe um dia invalido.')
    }

    day.tasks.forEach((task) => {
      const isKnownType = Object.values(TASK_TYPES).includes(task.type)
      if (!isKnownType || !task.content || !task.prompt || !task.expectedAnswer) {
        throw new Error('A resposta da IA trouxe uma tarefa invalida.')
      }
    })
  })

  return parsed
}

async function saveGeneratedTasks(uid: string, plan: GeneratedPlan) {
  const taskWrites = plan.days.flatMap((day) =>
    day.tasks.map((task, index) => ({
      id: `day-${day.day}-task-${index + 1}`,
      data: {
        ...task,
        words: Array.isArray(task.words) ? task.words : [],
        hints: Array.isArray(task.hints) ? task.hints : [],
        translation: typeof task.translation === 'string' ? task.translation : '',
        sentenceParts: Array.isArray(task.sentenceParts) ? task.sentenceParts : [],
        day: day.day,
        order: index + 1,
        theme: day.theme,
        completed: false,
        createdAt: serverTimestamp(),
      },
    })),
  )

  for (let index = 0; index < taskWrites.length; index += 450) {
    const batch = writeBatch(db)
    const chunk = taskWrites.slice(index, index + 450)

    chunk.forEach((task) => {
      batch.set(doc(collection(db, 'users', uid, 'tasks'), task.id), task.data)
    })

    await batch.commit()
  }
}
