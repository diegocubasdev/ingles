import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { localDb } from "./localDb";
import { saveGeneratedPlanLocally } from "./studyPlanService";
import {
  PLAN_DAYS,
  TASK_TYPES,
  type EnglishLevel,
  type GeneratedPlan,
  type PlanType,
  type Task,
  type TechStack,
} from "../types";

export function buildGeminiPrompt(
  currentLevel: EnglishLevel,
  techStack: TechStack,
  totalDays: number,
) {
  return `You are an English acquisition expert for Brazilian software developers preparing for international jobs.

Create an offline-first speaking/listening training plan as STRICT JSON only.

Student level: ${currentLevel}
Developer stack: ${techStack}
Plan length in days: ${totalDays}

Generate exactly ${totalDays} day objects. Each day must contain exactly 4 tasks:
- 1 shadowing
- 1 blind_dictation
- 1 rapid_fire
- 1 mock_interview

Use ONLY jargon and situations from ${techStack}. Examples must feel like real work: pull requests, deploy failures, standups, incidents, CORS, API contracts, CI, debugging, cloud, tests, refactors, product pressure.

Return this exact JSON shape:
{
  "days": [
    {
      "day": 1,
      "theme": "string",
      "tasks": [
        {
          "type": "shadowing",
          "content": "English sentence spoken by TTS at native speed.",
          "prompt": "Repeat exactly what you hear.",
          "expectedAnswer": "Exact English sentence.",
          "acceptableAnswers": ["Exact English sentence", "Minor variant"],
          "words": ["deploy", "review"],
          "keywords": ["deploy", "review"],
          "hints": ["short Brazilian Portuguese hint"],
          "translation": "Brazilian Portuguese translation",
          "sentenceParts": ["chunk", "chunk"]
        },
        {
          "type": "blind_dictation",
          "content": "Fast English sentence for dictation.",
          "prompt": "Type what you hear.",
          "expectedAnswer": "Exact English sentence.",
          "acceptableAnswers": ["Exact English sentence"],
          "words": [],
          "keywords": ["api", "bug"],
          "hints": ["short Brazilian Portuguese hint"],
          "translation": "Brazilian Portuguese translation",
          "sentenceParts": []
        },
        {
          "type": "rapid_fire",
          "content": "Portuguese sentence the user must say in English.",
          "prompt": "Say this in English before the timer ends.",
          "expectedAnswer": "Natural English answer.",
          "acceptableAnswers": ["Natural English answer", "Natural variant"],
          "words": [],
          "keywords": ["database", "down"],
          "hints": ["short Brazilian Portuguese hint"],
          "translation": "Brazilian Portuguese translation",
          "sentenceParts": []
        },
        {
          "type": "mock_interview",
          "content": "Daily standup simulation for ${techStack}.",
          "prompt": "Answer the three questions like a real daily.",
          "expectedAnswer": "Speak clearly about yesterday, today, and blockers.",
          "acceptableAnswers": ["yesterday today blockers"],
          "words": [],
          "keywords": ["yesterday", "today", "blocker"],
          "hints": ["short Brazilian Portuguese hint"],
          "translation": "Daily standup",
          "sentenceParts": [],
          "interviewQuestions": [
            "What did you work on yesterday?",
            "What will you focus on today?",
            "Do you have any blockers?"
          ]
        }
      ]
    }
  ]
}

Rules:
- All English must be natural, short, and useful in international software teams.
- acceptableAnswers must enable local validation without AI.
- keywords must be lowercase English words used for local matching.
- mock_interview must always include exactly 3 interviewQuestions.
- Avoid offensive, adult, political, medical, or legally sensitive content.
- Keep JSON valid and parseable by JSON.parse.`;
}

export async function generateIntensivePlan(
  uid: string,
  currentLevel: EnglishLevel,
  planType: PlanType,
  techStack: TechStack,
) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Configure VITE_GEMINI_API_KEY para gerar o plano.");
  }

  const totalDays = PLAN_DAYS[planType];
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: import.meta.env.VITE_GEMINI_MODEL ?? "gemini-flash-latest",
    generationConfig: { responseMimeType: "application/json" },
  });

  const response = await model.generateContent(
    buildGeminiPrompt(currentLevel, techStack, totalDays),
  );
  const plan = parseGeneratedPlan(response.response.text(), totalDays);
  const tasks = flattenGeneratedTasks(uid, plan);

  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, "users", uid);
    const userSnapshot = await transaction.get(userRef);

    if (!userSnapshot.exists()) {
      throw new Error("Usuario nao encontrado.");
    }

    const activePlan = userSnapshot.data().activePlan as PlanType | null;
    if (activePlan !== null) {
      throw new Error("Voce ja possui um plano ativo.");
    }

    transaction.set(doc(db, "users", uid, "studyPlan", "current"), {
      uid,
      activePlan: planType,
      totalDays,
      completedDays: [],
      currentDay: 1,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(userRef, {
      techStack,
      activePlan: planType,
      planStartDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await saveGeneratedTasks(uid, tasks);
  await saveGeneratedPlanLocally({ uid, activePlan: planType, totalDays, tasks });
  await localDb.users.update(uid, {
    techStack,
    activePlan: planType,
    planStartDate: new Date().toISOString(),
  });
}

export async function evaluateMockInterview(transcripts: string[]) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Configure VITE_GEMINI_API_KEY para avaliar a entrevista.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: import.meta.env.VITE_GEMINI_MODEL ?? "gemini-flash-latest",
  });

  const response = await model.generateContent(`Evaluate this software daily standup in concise Brazilian Portuguese.
Give 3 bullets: grammar, clarity, and one better version in English.

Transcript:
${transcripts.map((item, index) => `${index + 1}. ${item}`).join("\n")}`);

  return response.response.text();
}

function parseGeneratedPlan(rawText: string, totalDays: number): GeneratedPlan {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as GeneratedPlan;

  if (!Array.isArray(parsed.days) || parsed.days.length !== totalDays) {
    throw new Error("A resposta da IA nao trouxe a quantidade esperada de dias.");
  }

  parsed.days.forEach((day) => {
    if (!Number.isInteger(day.day) || !day.theme || day.tasks.length !== 4) {
      throw new Error("A resposta da IA trouxe um dia invalido.");
    }

    day.tasks.forEach((task) => {
      const isKnownType = Object.values(TASK_TYPES).includes(task.type);
      if (!isKnownType || !task.content || !task.prompt || !task.expectedAnswer) {
        throw new Error("A resposta da IA trouxe uma tarefa invalida.");
      }
    });
  });

  return parsed;
}

function flattenGeneratedTasks(uid: string, plan: GeneratedPlan): Task[] {
  return plan.days.flatMap((day) =>
    day.tasks.map((task, index) => ({
      ...task,
      uid,
      id: `day-${day.day}-task-${index + 1}`,
      acceptableAnswers: normalizeList(task.acceptableAnswers, task.expectedAnswer),
      words: Array.isArray(task.words) ? task.words : [],
      keywords: normalizeList(task.keywords),
      hints: Array.isArray(task.hints) ? task.hints : [],
      translation: typeof task.translation === "string" ? task.translation : "",
      sentenceParts: Array.isArray(task.sentenceParts) ? task.sentenceParts : [],
      interviewQuestions: Array.isArray(task.interviewQuestions)
        ? task.interviewQuestions.slice(0, 3)
        : undefined,
      day: day.day,
      order: index + 1,
      theme: day.theme,
      completed: false,
      createdAt: new Date().toISOString(),
    })),
  );
}

async function saveGeneratedTasks(uid: string, tasks: Task[]) {
  for (let index = 0; index < tasks.length; index += 450) {
    const batch = writeBatch(db);
    const chunk = tasks.slice(index, index + 450);

    chunk.forEach((task) => {
      batch.set(doc(collection(db, "users", uid, "tasks"), task.id), task);
    });

    await batch.commit();
  }
}

function normalizeList(value: unknown, fallback?: string) {
  const values = Array.isArray(value) ? value.filter(Boolean).map(String) : [];
  if (fallback && !values.includes(fallback)) values.unshift(fallback);
  return values;
}
