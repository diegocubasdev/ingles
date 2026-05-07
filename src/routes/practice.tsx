import { Link, useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, Lightbulb, Loader2, Mic, Play, RotateCcw, Trophy, Volume2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useGamification } from '../hooks/useGamification'
import { speakEnglish } from '../services/speechService'
import { completeDay, completeTask, getCurrentStudyPlan, getTasksForDay } from '../services/studyPlanService'
import { answersMatch, normalizeAnswer, similarity } from '../services/textUtils'
import { getOrCreateUser } from '../services/userService'
import { TASK_TYPES, type StudyPlan, type Task, type User } from '../types'

type Feedback = 'idle' | 'correct' | 'almost' | 'wrong'
type SpeechRecognitionConstructor = new () => SpeechRecognition

interface SpeechRecognition extends EventTarget {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string
      }
    }
  }
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
    webkitAudioContext?: typeof AudioContext
  }
}

export function PracticePage() {
  const [user, setUser] = useState<User | null>(null)
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [completionModal, setCompletionModal] = useState<{ xpEarned: number; streakDays: number } | null>(null)
  const navigate = useNavigate()
  const { checkAndUpdateStreak, triggerSuccessConfetti } = useGamification(user?.uid)

  useEffect(() => {
    void loadPractice()
  }, [])

  async function loadPractice() {
    setLoading(true)
    setError(null)

    try {
      const currentUser = await getOrCreateUser()
      const currentPlan = await getCurrentStudyPlan(currentUser.uid)

      if (!currentUser.activePlan || !currentPlan) {
        setUser(currentUser)
        setStudyPlan(null)
        setTasks([])
        return
      }

      const isPlanComplete = currentPlan.completedDays.length >= currentPlan.totalDays
      const day = Math.min(currentPlan.currentDay, currentPlan.totalDays)
      const dayTasks = isPlanComplete ? [] : await getTasksForDay(currentUser.uid, day)
      setUser(currentUser)
      setStudyPlan(currentPlan)
      setTasks(dayTasks)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Nao foi possivel carregar as tarefas.')
    } finally {
      setLoading(false)
    }
  }

  async function handleTaskSuccess(task: Task, xpAward: number) {
    if (!user || !studyPlan) return

    await completeTask(user.uid, task, xpAward)

    if (currentIndex < tasks.length - 1) {
      setCurrentIndex((index) => index + 1)
      return
    }

    setFinishing(true)
    await completeDay(user.uid, studyPlan.currentDay, studyPlan.completedDays)
    triggerSuccessConfetti()
    const streakDays = await checkAndUpdateStreak()
    const maxDayXp = tasks.length * 10
    const dayXp = Math.max(5, maxDayXp - 10 + xpAward)
    setCompletionModal({ xpEarned: dayXp, streakDays })
    setFinishing(false)
  }

  function closeCompletionModal() {
    setCompletionModal(null)
    void navigate({ to: '/dashboard' })
  }

  const currentTask = tasks[currentIndex]
  const dayLabel = studyPlan ? `Dia ${Math.min(studyPlan.currentDay, studyPlan.totalDays)}` : 'Pratica'

  if (loading) return <PracticeShell status="Carregando tarefas do dia..." />
  if (error) return <PracticeShell status={error} />

  if (studyPlan && studyPlan.completedDays.length >= studyPlan.totalDays) {
    return (
      <PracticeShell status="Plano concluido. Seu roadmap chegou a 100%.">
        <Link
          to="/dashboard"
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
        >
          Ver roadmap
        </Link>
      </PracticeShell>
    )
  }

  if (!studyPlan || tasks.length === 0 || !currentTask) {
    return (
      <PracticeShell status="Nenhum plano ativo encontrado. Gere sua trilha no dashboard.">
        <Link
          to="/dashboard"
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
        >
          Ir para o dashboard
        </Link>
      </PracticeShell>
    )
  }

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_1fr] lg:py-10">
      <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Roadmap
        </Link>
        <h1 className="mt-5 text-3xl font-semibold tracking-normal text-slate-950 dark:text-white">{dayLabel}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{currentTask.theme}</p>
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300">
            <span>
              Step {currentIndex + 1} of {tasks.length}
            </span>
            <span>{Math.round(((currentIndex + 1) / tasks.length) * 100)}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-slate-950 transition-all dark:bg-white"
              style={{ width: `${((currentIndex + 1) / tasks.length) * 100}%` }}
            />
          </div>
        </div>
      </aside>

      <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTask.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
          >
            <TaskRunner
              task={currentTask}
              busy={finishing}
              onSuccess={(xpAward) => void handleTaskSuccess(currentTask, xpAward)}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <DayCompleteModal completion={completionModal} onClose={closeCompletionModal} />
    </section>
  )
}

function TaskRunner({ task, busy, onSuccess }: { task: Task; busy: boolean; onSuccess: (xpAward: number) => void }) {
  if (task.type === TASK_TYPES.LISTENING) return <ListeningTask task={task} busy={busy} onSuccess={onSuccess} />
  if (task.type === TASK_TYPES.PRONUNCIATION) return <PronunciationTask task={task} busy={busy} onSuccess={onSuccess} />
  return <BuildingTask task={task} busy={busy} onSuccess={onSuccess} />
}

function ListeningTask({ task, busy, onSuccess }: TaskProps) {
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<Feedback>('idle')
  const [hintUsed, setHintUsed] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)

  function checkAnswer() {
    const isCorrect = answersMatch(answer, task.expectedAnswer)
    setFeedback(isCorrect ? 'correct' : 'wrong')
    playFeedbackSound(isCorrect)
    if (isCorrect) onSuccess(10)
  }

  return (
    <TaskFrame label="Listening" prompt={task.prompt} feedback={feedback}>
      <button
        type="button"
        onClick={() => {
          setAudioError(null)
          void speakEnglish(task.content, { onError: setAudioError })
        }}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-4 font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 sm:w-auto"
      >
        <Volume2 className="size-5" aria-hidden="true" />
        Ouvir
      </button>
      {audioError ? <AudioError message={audioError} /> : null}
      <HintPanel task={task} hintUsed={hintUsed} onUseHint={() => setHintUsed(true)} />
      <input
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Digite o que ouviu ou a resposta"
        className="mt-5 w-full rounded-lg border border-slate-300 bg-white px-4 py-4 text-slate-950 outline-none focus:border-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-white"
      />
      <SpeechAnswerButton
        onTranscript={(transcript) => {
          setAnswer(transcript)
          const isCorrect = answersMatch(transcript, task.expectedAnswer)
          setFeedback(isCorrect ? 'correct' : 'wrong')
          playFeedbackSound(isCorrect)
          if (isCorrect) onSuccess(10)
        }}
      />
      <PrimaryAction busy={busy} onClick={checkAnswer} />
    </TaskFrame>
  )
}

function PronunciationTask({ task, busy, onSuccess }: TaskProps) {
  const [recognizedText, setRecognizedText] = useState('')
  const [listening, setListening] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>('idle')
  const [hintUsed, setHintUsed] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const SpeechRecognitionApi = window.SpeechRecognition ?? window.webkitSpeechRecognition
  const isSupported = Boolean(SpeechRecognitionApi)

  function startRecording() {
    if (!SpeechRecognitionApi) return

    const recognition = new SpeechRecognitionApi()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      const score = similarity(transcript, task.expectedAnswer)
      const isCorrect = score >= 0.82
      setRecognizedText(transcript)
      setFeedback(isCorrect ? 'correct' : score >= 0.68 ? 'almost' : 'wrong')
      playFeedbackSound(isCorrect)
      if (isCorrect) onSuccess(10)
    }
    recognition.onerror = () => {
      setFeedback('wrong')
      playFeedbackSound(false)
      setListening(false)
    }
    recognition.onend = () => setListening(false)
    setListening(true)
    recognition.start()
  }

  return (
    <TaskFrame label="Pronunciation" prompt={task.prompt} feedback={feedback}>
      <HintPanel task={task} hintUsed={hintUsed} onUseHint={() => setHintUsed(true)} />
      <div className="rounded-lg bg-slate-50 p-5 text-2xl font-semibold leading-snug text-slate-950 dark:bg-slate-950 dark:text-white">
        {task.expectedAnswer}
      </div>
      <button
        type="button"
        onClick={() => {
          setAudioError(null)
          void speakEnglish(task.expectedAnswer, { onError: setAudioError })
        }}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-4 font-semibold text-slate-700 hover:border-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:border-white sm:w-auto"
      >
        <Volume2 className="size-5" aria-hidden="true" />
        Ouvir modelo
      </button>
      {audioError ? <AudioError message={audioError} /> : null}
      {isSupported ? (
        <button
          type="button"
          onClick={startRecording}
          disabled={listening || busy}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-4 font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 sm:w-auto"
        >
          {listening ? <Loader2 className="size-5 animate-spin" /> : <Mic className="size-5" />}
          {listening ? 'Ouvindo...' : 'Gravar audio'}
        </button>
      ) : (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Reconhecimento de fala indisponivel neste navegador.
        </div>
      )}
      {recognizedText ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Reconhecido: <span className="font-semibold text-slate-950 dark:text-white">{recognizedText}</span>
        </p>
      ) : null}
    </TaskFrame>
  )
}

function BuildingTask({ task, busy, onSuccess }: TaskProps) {
  const initialWords = useMemo(() => task.words.map((word, index) => ({ id: `${word}-${index}`, word })), [task.words])
  const [available, setAvailable] = useState(initialWords)
  const [selected, setSelected] = useState<typeof initialWords>([])
  const [feedback, setFeedback] = useState<Feedback>('idle')
  const [hintUsed, setHintUsed] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const firstExpectedWord = normalizeAnswer(task.expectedAnswer).split(' ')[0]

  function chooseWord(id: string) {
    const word = available.find((item) => item.id === id)
    if (!word) return
    setAvailable((items) => items.filter((item) => item.id !== id))
    setSelected((items) => [...items, word])
    setFeedback('idle')
  }

  function removeWord(id: string) {
    const word = selected.find((item) => item.id === id)
    if (!word) return
    setSelected((items) => items.filter((item) => item.id !== id))
    setAvailable((items) => [...items, word])
    setFeedback('idle')
  }

  function reset() {
    setAvailable(initialWords)
    setSelected([])
    setFeedback('idle')
  }

  function checkAnswer() {
    const sentence = selected.map((item) => item.word).join(' ')
    const isCorrect = answersMatch(sentence, task.expectedAnswer)
    setFeedback(isCorrect ? 'correct' : 'wrong')
    playFeedbackSound(isCorrect)
    if (isCorrect) onSuccess(10)
  }

  return (
    <TaskFrame label="Building" prompt={task.content} feedback={feedback}>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{task.prompt}</p>
      <HintPanel task={task} hintUsed={hintUsed} onUseHint={() => setHintUsed(true)} />
      <div className="mt-4 min-h-24 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
        <div className="flex flex-wrap gap-2">
          {selected.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => removeWord(item.id)}
              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
            >
              {item.word}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {available.map((item) => {
          const shouldHighlight = hintUsed && normalizeAnswer(item.word) === firstExpectedWord
          return (
            <motion.button
              key={item.id}
              type="button"
              animate={shouldHighlight ? { scale: [1, 1.08, 1], borderColor: '#f59e0b' } : { scale: 1 }}
              transition={{ duration: 0.8, repeat: shouldHighlight ? Infinity : 0 }}
              onClick={() => chooseWord(item.id)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-white"
            >
              {item.word}
            </motion.button>
          )
        })}
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            setAudioError(null)
            void speakEnglish(task.expectedAnswer, { onError: setAudioError })
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:border-white"
        >
          <Volume2 className="size-4" aria-hidden="true" />
          Ouvir frase
        </button>
        <SpeechAnswerButton
          compact
          onTranscript={(transcript) => {
            const isCorrect = answersMatch(transcript, task.expectedAnswer)
            setFeedback(isCorrect ? 'correct' : 'wrong')
            playFeedbackSound(isCorrect)
            if (isCorrect) onSuccess(10)
          }}
        />
      </div>
      {audioError ? <AudioError message={audioError} /> : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:border-white"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Refazer
        </button>
        <PrimaryAction busy={busy} onClick={checkAnswer} disabled={selected.length === 0} />
      </div>
    </TaskFrame>
  )
}

interface TaskProps {
  task: Task
  busy: boolean
  onSuccess: (xpAward: number) => void
}

function TaskFrame({
  label,
  prompt,
  feedback,
  children,
}: {
  label: string
  prompt: string
  feedback: Feedback
  children: React.ReactNode
}) {
  return (
    <div>
      <span className="inline-flex rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        {label}
      </span>
      <h2 className="mt-4 text-2xl font-semibold tracking-normal text-slate-950 dark:text-white sm:text-3xl">{prompt}</h2>
      <div className="mt-6">{children}</div>
      <FeedbackMessage feedback={feedback} />
    </div>
  )
}

function HintPanel({
  task,
  hintUsed,
  onUseHint,
}: {
  task: Task
  hintUsed: boolean
  onUseHint: () => void
}) {
  const hasHints = Boolean(task.hints?.length)
  const hasParts = Boolean(task.sentenceParts?.length)
  const translation = task.translation || 'Traducao indisponivel para esta tarefa antiga.'

  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <button
        type="button"
        onClick={onUseHint}
        disabled={hintUsed}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 disabled:opacity-70 dark:text-slate-200"
      >
        <Lightbulb className="size-4 text-amber-500" aria-hidden="true" />
        {hintUsed ? 'Dica aberta' : 'Ver dica da resposta'}
      </button>

      {hintUsed ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold">Resposta:</p>
            <p className="mt-1">{task.expectedAnswer}</p>
            <button
              type="button"
              onClick={() => void speakEnglish(task.expectedAnswer)}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-200 dark:bg-amber-400/20 dark:text-amber-100"
            >
              <Volume2 className="size-4" aria-hidden="true" />
              Ouvir como se fala
            </button>
          </div>

          {task.type !== TASK_TYPES.BUILDING ? (
            <p className="rounded-lg bg-white/70 p-3 text-sm text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
              {translation}
            </p>
          ) : (
            <p className="rounded-lg bg-white/70 p-3 text-sm text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
              Primeira palavra: <span className="font-semibold">{task.expectedAnswer.split(/\s+/)[0]}</span>
            </p>
          )}

          {hasParts ? (
            <div className="flex flex-wrap gap-2">
              {task.sentenceParts?.map((part, index) => (
                <span
                  key={`${part}-${index}`}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {part}
                </span>
              ))}
            </div>
          ) : null}

          {hasHints ? (
            <ul className="space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {task.hints?.map((hint, index) => <li key={`${hint}-${index}`}>{hint}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function AudioError({ message }: { message: string }) {
  return <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">{message}</p>
}

function SpeechAnswerButton({
  onTranscript,
  compact,
}: {
  onTranscript: (transcript: string) => void
  compact?: boolean
}) {
  const [listening, setListening] = useState(false)
  const SpeechRecognitionApi = window.SpeechRecognition ?? window.webkitSpeechRecognition

  if (!SpeechRecognitionApi) return null

  function startRecording() {
    if (!SpeechRecognitionApi) return

    const recognition = new SpeechRecognitionApi()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => onTranscript(event.results[0][0].transcript)
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    setListening(true)
    recognition.start()
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      disabled={listening}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:border-slate-950 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-white',
        compact ? 'px-4 py-3' : 'mt-3 w-full px-4 py-4 sm:w-auto',
      ].join(' ')}
    >
      {listening ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
      {listening ? 'Ouvindo...' : 'Responder falando'}
    </button>
  )
}

function PrimaryAction({
  busy,
  onClick,
  disabled,
}: {
  busy: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-4 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 sm:w-auto"
    >
      {busy ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
      Conferir
    </button>
  )
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (feedback === 'idle') return null

  const styles = {
    correct: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    almost: 'border-amber-200 bg-amber-50 text-amber-800',
    wrong: 'border-red-200 bg-red-50 text-red-700',
  }

  const messages = {
    correct: 'Boa. Resposta aceita.',
    almost: 'Quase la. Tente falar um pouco mais claro.',
    wrong: 'Ainda nao. Revise e tente novamente.',
  }

  return <div className={`mt-5 rounded-lg border px-4 py-3 text-sm font-medium ${styles[feedback]}`}>{messages[feedback]}</div>
}

function DayCompleteModal({
  completion,
  onClose,
}: {
  completion: { xpEarned: number; streakDays: number } | null
  onClose: () => void
}) {
  if (!completion) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mx-auto grid size-14 place-items-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
          <Trophy className="size-7" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">Dia concluido</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Excelente ritmo. Voce ganhou {completion.xpEarned} XP hoje e sua ofensiva esta em {completion.streakDays}{' '}
          {completion.streakDays === 1 ? 'dia' : 'dias'}.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          Voltar ao dashboard
        </button>
      </motion.div>
    </div>
  )
}

function PracticeShell({ status, children }: { status: string; children?: React.ReactNode }) {
  return (
    <section className="mx-auto flex min-h-[70svh] w-full max-w-3xl items-center justify-center px-4">
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Play className="mx-auto size-8 text-slate-500" aria-hidden="true" />
        <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">{status}</p>
        {children}
      </div>
    </section>
  )
}

function playFeedbackSound(isCorrect: boolean) {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext
  if (!AudioContextClass) return

  const audioContext = new AudioContextClass()
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()

  oscillator.type = isCorrect ? 'sine' : 'sawtooth'
  oscillator.frequency.setValueAtTime(isCorrect ? 880 : 160, audioContext.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(isCorrect ? 1320 : 90, audioContext.currentTime + 0.12)
  gain.gain.setValueAtTime(0.001, audioContext.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.18)

  oscillator.connect(gain)
  gain.connect(audioContext.destination)
  oscillator.start()
  oscillator.stop(audioContext.currentTime + 0.2)
}
