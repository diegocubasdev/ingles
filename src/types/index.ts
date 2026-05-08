import type { Timestamp } from "firebase/firestore";

export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1";

export type PlanType =
  | "7_days"
  | "15_days"
  | "30_days"
  | "3_months"
  | "6_months";

export const PLAN_DAYS: Record<PlanType, number> = {
  "7_days": 7,
  "15_days": 15,
  "30_days": 30,
  "3_months": 90,
  "6_months": 180,
};

export const TECH_STACK_OPTIONS = [
  "Frontend/React",
  "Backend/Node",
  "Fullstack",
  "Mobile",
  "DevOps/Cloud",
] as const;

export type TechStack = (typeof TECH_STACK_OPTIONS)[number];

export const TASK_TYPES = {
  SHADOWING: "shadowing",
  BLIND_DICTATION: "blind_dictation",
  RAPID_FIRE: "rapid_fire",
  MOCK_INTERVIEW: "mock_interview",
} as const;

export type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES];
export type PracticeState =
  | "idle"
  | "preparing_audio"
  | "playing"
  | "recording"
  | "validating";

export interface User {
  uid: string;
  name: string;
  currentLevel: EnglishLevel;
  techStack: TechStack | null;
  xp: number;
  streakDays: number;
  lastActiveDate: string | null;
  activePlan: PlanType | null;
  planStartDate: Timestamp | string | null;
}

export interface Task {
  id: string;
  uid?: string;
  type: TaskType;
  content: string;
  prompt: string;
  contextScenario: string;
  instructionText: string;
  grammarFocus: string;
  expectedAnswer: string;
  acceptableAnswers: string[];
  words: string[];
  keywords: string[];
  hints?: string[];
  translation?: string;
  sentenceParts?: string[];
  interviewQuestions?: string[];
  day: number;
  order: number;
  theme: string;
  completed: boolean;
  xpAward?: number;
  createdAt?: Timestamp | string;
  completedAt?: Timestamp | string;
}

export interface StudyPlan {
  uid: string;
  activePlan: PlanType;
  totalDays: number;
  completedDays: number[];
  currentDay: number;
  startedAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface PracticeAttempt {
  id: string;
  uid: string;
  taskId: string;
  taskType: TaskType;
  transcript: string;
  score: number;
  correct: boolean;
  createdAt: string;
}

export type SyncQueueAction =
  | "completeTask"
  | "completeDay"
  | "updateUser"
  | "resetPlan";

export interface SyncQueueItem {
  id?: number;
  uid: string;
  action: SyncQueueAction;
  payload: unknown;
  createdAt: string;
  attempts: number;
}

export interface GeneratedDay {
  day: number;
  theme: string;
  tasks: Array<Omit<Task, "id" | "uid" | "day" | "theme" | "completed" | "createdAt">>;
}

export interface GeneratedPlan {
  days: GeneratedDay[];
}
