import type { Timestamp } from 'firebase/firestore'

export type EnglishLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'

export type PlanType = '7_days' | '15_days' | '30_days' | '3_months' | '6_months'

export const PLAN_DAYS: Record<PlanType, number> = {
  '7_days': 7,
  '15_days': 15,
  '30_days': 30,
  '3_months': 90,
  '6_months': 180,
}

export const TASK_TYPES = {
  BUILDING: 'BUILDING',
  LISTENING: 'LISTENING',
  PRONUNCIATION: 'PRONUNCIATION',
  DAILY_STANDUP: 'DAILY_STANDUP',
  TECH_SHADOWING: 'TECH_SHADOWING',
  CODE_REVIEW_LISTENING: 'CODE_REVIEW_LISTENING',
} as const

export type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES]

export interface User {
  uid: string
  name: string
  currentLevel: EnglishLevel
  xp: number
  streakDays: number
  lastActiveDate: string | null
  activePlan: PlanType | null
  planStartDate: Timestamp | null
}

export interface Task {
  id: string
  type: TaskType
  content: string
  prompt: string
  expectedAnswer: string
  words: string[]
  hints?: string[]
  translation?: string
  sentenceParts?: string[]
  day: number
  order: number
  theme: string
  completed: boolean
  createdAt?: Timestamp
}

export interface StudyPlan {
  uid: string
  activePlan: PlanType
  totalDays: number
  completedDays: number[]
  currentDay: number
  startedAt: Timestamp
  updatedAt: Timestamp
}

export interface GeneratedDay {
  day: number
  theme: string
  tasks: Array<Omit<Task, 'id' | 'day' | 'theme' | 'completed' | 'createdAt'>>
}

export interface GeneratedPlan {
  days: GeneratedDay[]
}
