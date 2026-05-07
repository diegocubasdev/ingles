import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bell,
  BellOff,
  CalendarDays,
  CheckCircle2,
  Flame,
  Loader2,
  LockKeyhole,
  Play,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  disableDailyStudyNotifications,
  enableDailyStudyNotifications,
  getNotificationSettings,
} from '../services/notificationService'
import { speakEnglish } from '../services/speechService'
import { generateIntensivePlan } from '../services/taskGenerator'
import { getCurrentStudyPlan } from '../services/studyPlanService'
import { getOrCreateUser, timestampToDate } from '../services/userService'
import { PLAN_DAYS, type PlanType, type StudyPlan, type User } from '../types'

const planOptions: Array<{ id: PlanType; label: string; description: string }> = [
  { id: '7_days', label: '7 dias', description: 'Sprint curto para ativar rotina.' },
  { id: '15_days', label: '15 dias', description: 'Ritmo forte com boa aderencia.' },
  { id: '30_days', label: '30 dias', description: 'Imersao estruturada por um mes.' },
  { id: '3_months', label: '3 meses', description: 'Progressao consistente e profunda.' },
  { id: '6_months', label: '6 meses', description: 'Trilha longa de alta intensidade.' },
]

export function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingPlan, setGeneratingPlan] = useState<PlanType | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    setError(null)

    try {
      const currentUser = await getOrCreateUser()
      const currentPlan = await getCurrentStudyPlan(currentUser.uid)
      setUser(currentUser)
      setStudyPlan(currentPlan)
    } catch (caughtError) {
      setError(errorMessage(caughtError))
    } finally {
      setLoading(false)
    }
  }

  async function handleGeneratePlan(planType: PlanType) {
    if (!user || user.activePlan !== null) return

    setGeneratingPlan(planType)
    setError(null)

    try {
      await generateIntensivePlan(user.uid, user.currentLevel, planType)
      await loadDashboard()
    } catch (caughtError) {
      setError(errorMessage(caughtError))
    } finally {
      setGeneratingPlan(null)
    }
  }

  if (loading) {
    return <PageShell status="Carregando seu workspace de estudo..." />
  }

  if (!user) {
    return <PageShell status={error ?? 'Nao foi possivel carregar o usuario.'} />
  }

  const hasActivePlan = user.activePlan !== null

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-10">
      <aside className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Nivel atual</p>
          <div className="mt-3 flex items-end justify-between">
            <h1 className="text-4xl font-semibold tracking-normal text-slate-950 dark:text-white">{user.currentLevel}</h1>
            <span className="rounded-md bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              {user.xp} XP
            </span>
          </div>
          <StreakBadge streakDays={user.streakDays ?? 0} />
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Seu roteiro e gerado uma unica vez e salvo no Firestore para reduzir custo de API.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <LockKeyhole className="size-5 text-slate-500" aria-hidden="true" />
            <h2 className="font-semibold text-slate-950 dark:text-white">Trava de plano</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {hasActivePlan
              ? 'Plano ativo encontrado. A criacao de novos roteiros fica bloqueada ate este ciclo terminar.'
              : 'Nenhum plano ativo. Escolha uma duracao para gerar a trilha inicial.'}
          </p>
        </div>

        <NotificationCard />
        <IdiomOfTheDay />
      </aside>

      <div className="min-w-0">
        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {hasActivePlan ? (
          <ActivePlan user={user} studyPlan={studyPlan} />
        ) : (
          <InitialSetup generatingPlan={generatingPlan} onSelectPlan={handleGeneratePlan} />
        )}
      </div>
    </section>
  )
}

function StreakBadge({ streakDays }: { streakDays: number }) {
  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="mt-4 inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300"
    >
      <motion.span
        animate={{ rotate: [-4, 4, -4], scale: [1, 1.08, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Flame className="size-5 fill-orange-500 text-orange-500" aria-hidden="true" />
      </motion.span>
      {streakDays} {streakDays === 1 ? 'Dia' : 'Dias'}
    </motion.div>
  )
}

const idioms = [
  { phrase: 'Piece of cake', translation: 'Muito facil' },
  { phrase: 'Break the ice', translation: 'Quebrar o gelo' },
  { phrase: 'Hang in there', translation: 'Aguente firme' },
  { phrase: 'Better late than never', translation: 'Antes tarde do que nunca' },
  { phrase: 'Keep it up', translation: 'Continue assim' },
]

function IdiomOfTheDay() {
  const idiom = idioms[new Date().getDay() % idioms.length]

  function speakIdiom() {
    void speakEnglish(idiom.phrase, { rate: 0.88 })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Expressao do dia</p>
          <h2 className="mt-2 text-xl font-semibold tracking-normal text-slate-950 dark:text-white">{idiom.phrase}</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{idiom.translation}</p>
        </div>
        <button
          type="button"
          onClick={speakIdiom}
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          aria-label="Ouvir expressao"
          title="Ouvir expressao"
        >
          <Play className="size-4 fill-current" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function NotificationCard() {
  const [settings, setSettings] = useState(getNotificationSettings)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const hoursLabel = settings.hours.map((hour) => `${String(hour).padStart(2, '0')}:00`).join(', ')

  async function enable() {
    setBusy(true)
    setError(null)

    try {
      await enableDailyStudyNotifications()
      setSettings(getNotificationSettings())
    } catch (caughtError) {
      setError(errorMessage(caughtError))
    } finally {
      setBusy(false)
    }
  }

  function disable() {
    disableDailyStudyNotifications()
    setSettings(getNotificationSettings())
    setError(null)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        {settings.enabled ? (
          <Bell className="size-5 text-emerald-600" aria-hidden="true" />
        ) : (
          <BellOff className="size-5 text-slate-500" aria-hidden="true" />
        )}
        <h2 className="font-semibold text-slate-950 dark:text-white">Lembretes PWA</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Notificacoes locais todos os dias as {hoursLabel}.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row lg:flex-col">
        {settings.enabled ? (
          <button
            type="button"
            onClick={disable}
            className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:border-white"
          >
            Desativar notificacoes
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void enable()}
            disabled={busy || settings.permission === 'denied' || settings.permission === 'unsupported'}
            className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {busy ? 'Solicitando...' : 'Ativar notificacoes'}
          </button>
        )}
      </div>
      {settings.permission === 'denied' ? (
        <p className="mt-3 text-xs leading-5 text-red-700">
          Permissao bloqueada no navegador. Libere notificacoes nas configuracoes do site.
        </p>
      ) : null}
      {settings.permission === 'unsupported' ? (
        <p className="mt-3 text-xs leading-5 text-amber-800">Este navegador nao suporta notificacoes.</p>
      ) : null}
      {error ? <p className="mt-3 text-xs leading-5 text-red-700">{error}</p> : null}
    </div>
  )
}

function InitialSetup({
  generatingPlan,
  onSelectPlan,
}: {
  generatingPlan: PlanType | null
  onSelectPlan: (planType: PlanType) => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Setup inicial</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">
            Escolha seu plano intensivo
          </h2>
        </div>
        <Sparkles className="size-8 text-amber-500" aria-hidden="true" />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {planOptions.map((option) => {
          const isGenerating = generatingPlan === option.id
          return (
            <button
              key={option.id}
              type="button"
              disabled={generatingPlan !== null}
              onClick={() => onSelectPlan(option.id)}
              className="rounded-lg border border-slate-200 p-4 text-left transition hover:border-slate-950 hover:shadow-sm disabled:opacity-60 dark:border-slate-800 dark:hover:border-white"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-950 dark:text-white">{option.label}</span>
                {isGenerating ? (
                  <Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" />
                ) : (
                  <ArrowRight className="size-5 text-slate-400" aria-hidden="true" />
                )}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{option.description}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {PLAN_DAYS[option.id]} dias
              </p>
            </button>
          )
        })}
      </div>

      {generatingPlan ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-slate-950"
        >
          Criando seu plano intensivo... isso pode levar alguns instantes.
        </motion.div>
      ) : null}
    </div>
  )
}

function ActivePlan({ user, studyPlan }: { user: User; studyPlan: StudyPlan | null }) {
  const totalDays = user.activePlan ? PLAN_DAYS[user.activePlan] : 0
  const completedDays = studyPlan?.completedDays ?? []
  const progress = totalDays > 0 ? Math.round((completedDays.length / totalDays) * 100) : 0
  const startDate = timestampToDate(user.planStartDate)
  const visibleDays = useMemo(() => Array.from({ length: totalDays }, (_, index) => index + 1), [totalDays])

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Roadmap ativo</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">
            Plano de {totalDays} dias
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {startDate ? `Iniciado em ${startDate.toLocaleDateString('pt-BR')}` : 'Plano iniciado'}
          </p>
        </div>
        <Link
          to="/practice"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          Continuar tarefas do dia
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300">
          <span>{progress}% concluido</span>
          <span>
            {completedDays.length}/{totalDays} dias
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-7 md:grid-cols-10">
        {visibleDays.map((day) => {
          const isDone = completedDays.includes(day)
          const isCurrent = day === (studyPlan?.currentDay ?? 1)
          return (
              <div
              key={day}
              className={[
                'flex aspect-square items-center justify-center rounded-lg border text-sm font-semibold',
                isDone ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : '',
                isCurrent && !isDone ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950' : '',
                !isDone && !isCurrent ? 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400' : '',
              ].join(' ')}
              title={`Dia ${day}`}
            >
              {isDone ? <CheckCircle2 className="size-5" aria-hidden="true" /> : day}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PageShell({ status }: { status: string }) {
  return (
    <section className="mx-auto flex min-h-[70svh] w-full max-w-3xl items-center justify-center px-4">
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CalendarDays className="mx-auto size-8 text-slate-500" aria-hidden="true" />
        <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">{status}</p>
      </div>
    </section>
  )
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Algo saiu errado. Tente novamente.'
}
