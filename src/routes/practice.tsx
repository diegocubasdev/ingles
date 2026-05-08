import { Link, useNavigate } from "@tanstack/react-router";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  Keyboard,
  Loader2,
  Mic,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSound from "use-sound";
import { ShareableAchievement } from "../components/ShareableAchievement";
import { useAdvancedSpeech } from "../hooks/useAdvancedSpeech";
import { useGamification } from "../hooks/useGamification";
import { evaluateMockInterview } from "../services/taskGenerator";
import {
  completeDay,
  completeTask,
  getCurrentStudyPlan,
  getTasksForDay,
} from "../services/studyPlanService";
import { answersMatch, similarity } from "../services/textUtils";
import { getOrCreateUser } from "../services/userService";
import {
  TASK_TYPES,
  type PracticeState,
  type StudyPlan,
  type Task,
  type User,
} from "../types";

const DING =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
const BUZZ =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

type Feedback = "idle" | "correct" | "wrong" | "almost";

interface LastAttempt {
  expected: string;
  heard: string;
}

export function PracticePage() {
  const [user, setUser] = useState<User | null>(null);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<{ xp: number; streak: number } | null>(null);
  const navigate = useNavigate();
  const { checkAndUpdateStreak } = useGamification(user?.uid);

  const loadPractice = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const currentUser = await getOrCreateUser();
      const currentPlan = await getCurrentStudyPlan(currentUser.uid);

      if (!currentUser.activePlan || !currentPlan) {
        setUser(currentUser);
        setStudyPlan(null);
        setTasks([]);
        return;
      }

      const day = Math.min(currentPlan.currentDay, currentPlan.totalDays);
      const dayTasks = await getTasksForDay(currentUser.uid, day);
      setUser(currentUser);
      setStudyPlan(currentPlan);
      setTasks(dayTasks.filter((task) => !task.completed));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nao foi possivel carregar a pratica.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void loadPractice(), 0);
    return () => window.clearTimeout(id);
  }, [loadPractice]);

  async function handleSuccess(
    task: Task,
    transcript: string,
    score: number,
    xpAward: number,
  ) {
    if (!user || !studyPlan) return;

    await completeTask(user.uid, task, xpAward, {
      transcript,
      score,
      correct: true,
    });

    window.setTimeout(async () => {
      if (currentIndex < tasks.length - 1) {
        setCurrentIndex((index) => index + 1);
        return;
      }

      await completeDay(user.uid, studyPlan.currentDay, studyPlan.completedDays);
      fireConfetti();
      const streak = await checkAndUpdateStreak();
      setCompletion({ xp: tasks.length * 10, streak });
    }, 1500);
  }

  if (loading) return <PracticeShell status="Carregando drills offline..." />;
  if (error) return <PracticeShell status={error} />;

  if (!studyPlan || tasks.length === 0) {
    return (
      <PracticeShell status="Nenhuma tarefa pendente para hoje.">
        <Link className="mt-5 inline-flex rounded-lg bg-cyan-300 px-4 py-3 font-semibold text-slate-950" to="/dashboard">
          Voltar ao dashboard
        </Link>
      </PracticeShell>
    );
  }

  const currentTask = tasks[currentIndex];

  return (
    <section className="min-h-[calc(100svh-73px)] bg-slate-950 px-4 py-5 text-white sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-lg border border-white/10 bg-white/10 p-5 backdrop-blur-md">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
          <p className="mt-6 font-mono text-xs uppercase tracking-wide text-cyan-200">
            Dia {studyPlan.currentDay}
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{currentTask.theme}</h1>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-cyan-300 transition-all"
              style={{ width: `${((currentIndex + 1) / tasks.length) * 100}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-slate-300">
            Drill {currentIndex + 1} de {tasks.length}
          </p>
        </aside>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentTask.id}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.24 }}
            className="rounded-lg border border-white/10 bg-white/10 p-5 backdrop-blur-md"
          >
            <TaskRunner task={currentTask} onSuccess={handleSuccess} />
          </motion.div>
        </AnimatePresence>
      </div>

      {completion ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-lg border border-white/10 bg-white/10 p-5 text-center">
            <CheckCircle2 className="mx-auto size-12 text-emerald-300" />
            <h2 className="mt-4 text-2xl font-semibold">Dia concluido</h2>
            <p className="mt-2 text-sm text-slate-300">
              +{completion.xp} XP | Streak {completion.streak} dias
            </p>
            <div className="mt-5">
              <ShareableAchievement
                title="Dev English streak"
                subtitle={`${completion.streak} dias praticando speaking`}
                stat={`+${completion.xp} XP`}
              />
            </div>
            <button
              type="button"
              onClick={() => void navigate({ to: "/dashboard" })}
              className="mt-5 w-full rounded-lg bg-cyan-300 px-4 py-3 font-semibold text-slate-950"
            >
              Voltar ao dashboard
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TaskRunner({
  task,
  onSuccess,
}: {
  task: Task;
  onSuccess: (task: Task, transcript: string, score: number, xpAward: number) => void;
}) {
  if (task.type === TASK_TYPES.SHADOWING) {
    return <ShadowingTask task={task} onSuccess={onSuccess} />;
  }
  if (task.type === TASK_TYPES.BLIND_DICTATION) {
    return <BlindDictationTask task={task} onSuccess={onSuccess} />;
  }
  if (task.type === TASK_TYPES.RAPID_FIRE) {
    return <RapidFireTask task={task} onSuccess={onSuccess} />;
  }
  return <MockInterviewTask task={task} onSuccess={onSuccess} />;
}

function ShadowingTask({ task, onSuccess }: TaskProps) {
  const speech = useAdvancedSpeech();
  const feedback = useFeedbackSound();
  const [result, setResult] = useState<Feedback>("idle");
  const [revealed, setRevealed] = useState(false);
  const [attempt, setAttempt] = useState<LastAttempt | null>(null);

  async function record() {
    try {
      const transcript = await speech.startRecording();
      validateSpoken(task, transcript, revealed, setResult, setAttempt, feedback, onSuccess);
    } catch {
      markSpeechNotHeard(task, setResult, setAttempt, feedback);
    }
  }

  return (
    <TaskFrame
      task={task}
      state={speech.state}
      feedback={result}
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      attempt={attempt}
    >
      <ListenButton label="Ouvir frase em ingles" onClick={() => void speech.speak(task.content, 1)} />
      <MicButton recording={speech.isRecording} onClick={() => void record()} />
      <Transcript text={speech.transcript} />
    </TaskFrame>
  );
}

function BlindDictationTask({ task, onSuccess }: TaskProps) {
  const speech = useAdvancedSpeech();
  const feedback = useFeedbackSound();
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Feedback>("idle");
  const [revealed, setRevealed] = useState(false);
  const [attempt, setAttempt] = useState<LastAttempt | null>(null);

  function validate() {
    const score = scoreAnswer(answer, task);
    const correct = score >= 0.82 || revealed;
    setAttempt({ expected: task.expectedAnswer, heard: answer });
    setResult(correct ? "correct" : "wrong");
    feedback(correct);
    if (correct) onSuccess(task, answer, score, revealed ? 0 : 10);
  }

  return (
    <TaskFrame
      task={task}
      state={speech.state}
      feedback={result}
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      attempt={attempt}
    >
      <ListenButton label="Ouvir frase em ingles rapido" onClick={() => void speech.speak(task.content, 1.25)} />
      <label className="mt-6 flex items-center gap-2 text-base font-semibold text-slate-100">
        <Keyboard className="size-5" />
        Digite aqui o que voce ouviu
      </label>
      <input
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Ex: I deployed the hotfix."
        className="mt-3 w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-4 text-lg text-white outline-none focus:border-cyan-300"
      />
      <ActionButton disabled={!answer.trim()} onClick={validate}>
        Validar resposta
      </ActionButton>
    </TaskFrame>
  );
}

function RapidFireTask({ task, onSuccess }: TaskProps) {
  const speech = useAdvancedSpeech();
  const feedback = useFeedbackSound();
  const [seconds, setSeconds] = useState(5);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Feedback>("idle");
  const [revealed, setRevealed] = useState(false);
  const [attempt, setAttempt] = useState<LastAttempt | null>(null);

  useEffect(() => {
    if (!running || seconds <= 0) return;
    const id = window.setTimeout(() => {
      setSeconds((value) => {
        if (value <= 1) {
          setRunning(false);
          feedback(false);
          setResult("wrong");
          setAttempt({ expected: task.expectedAnswer, heard: "Tempo esgotado" });
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearTimeout(id);
  }, [feedback, running, seconds, task.expectedAnswer]);

  async function start() {
    setSeconds(5);
    setRunning(true);
    try {
      const transcript = await speech.startRecording(5);
      setRunning(false);
      validateSpoken(task, transcript, revealed, setResult, setAttempt, feedback, onSuccess);
    } catch {
      setRunning(false);
      markSpeechNotHeard(task, setResult, setAttempt, feedback);
    }
  }

  return (
    <TaskFrame
      task={task}
      state={speech.state}
      feedback={result}
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      attempt={attempt}
    >
      <div className="rounded-lg border border-white/10 bg-slate-950/60 p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Frase em portugues
        </p>
        <p className="mt-2 text-2xl font-semibold">{task.content}</p>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="grid size-16 place-items-center rounded-full border border-cyan-300 font-mono text-2xl text-cyan-200">
          {seconds}
        </span>
        <MicButton recording={speech.isRecording} onClick={() => void start()} />
      </div>
      <Transcript text={speech.transcript} />
    </TaskFrame>
  );
}

function MockInterviewTask({ task, onSuccess }: TaskProps) {
  const questions = useMemo(
    () =>
      task.interviewQuestions?.length === 3
        ? task.interviewQuestions
        : [
            "What did you work on yesterday?",
            "What will you focus on today?",
            "Do you have any blockers?",
          ],
    [task.interviewQuestions],
  );
  const speech = useAdvancedSpeech();
  const feedback = useFeedbackSound();
  const [answers, setAnswers] = useState<string[]>([]);
  const [aiFeedback, setAiFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Feedback>("idle");
  const [revealed, setRevealed] = useState(false);
  const currentQuestion = questions[answers.length];

  async function answerQuestion() {
    try {
      const transcript = await speech.startRecording(20);
      setAnswers((items) => [
        ...items,
        transcript || "Nao consegui capturar sua resposta.",
      ]);
    } catch {
      setAnswers((items) => [...items, "Nao consegui capturar sua resposta."]);
      setResult("wrong");
      feedback(false);
    }
  }

  async function finish() {
    setLoading(true);
    try {
      const response = await evaluateMockInterview(answers);
      setAiFeedback(response);
      setResult("correct");
      feedback(true);
      onSuccess(task, answers.join(" "), 1, revealed ? 0 : 10);
    } catch (error) {
      setAiFeedback(error instanceof Error ? error.message : "Feedback indisponivel.");
      setResult("almost");
    } finally {
      setLoading(false);
    }
  }

  return (
    <TaskFrame
      task={task}
      state={loading ? "validating" : speech.state}
      feedback={result}
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      attempt={null}
    >
      {currentQuestion ? (
        <>
          <div className="rounded-lg border border-white/10 bg-slate-950/60 p-5">
            <p className="text-sm text-slate-400">Pergunta {answers.length + 1}/3</p>
            <p className="mt-2 text-2xl font-semibold">{currentQuestion}</p>
          </div>
          <div className="mt-4">
            <ListenButton
              label="Ouvir pergunta em ingles"
              onClick={() => void speech.speak(currentQuestion, 1)}
            />
          </div>
          <MicButton recording={speech.isRecording} onClick={() => void answerQuestion()} />
        </>
      ) : (
        <ActionButton disabled={loading} onClick={() => void finish()}>
          {loading ? "Avaliando em 1 request..." : "Enviar feedback final"}
        </ActionButton>
      )}
      <div className="mt-5 space-y-2">
        {answers.map((answer, index) => (
          <p key={index} className="rounded-lg bg-slate-950/60 p-3 text-sm text-slate-300">
            {index + 1}. {answer || "Sem fala detectada"}
          </p>
        ))}
      </div>
      {aiFeedback ? (
        <div className="mt-5 whitespace-pre-line rounded-lg border border-emerald-300/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          {aiFeedback}
        </div>
      ) : null}
    </TaskFrame>
  );
}

interface TaskProps {
  task: Task;
  onSuccess: (task: Task, transcript: string, score: number, xpAward: number) => void;
}

function TaskFrame({
  task,
  state,
  feedback,
  revealed,
  onReveal,
  attempt,
  children,
}: {
  task: Task;
  state: PracticeState;
  feedback: Feedback;
  revealed: boolean;
  onReveal: () => void;
  attempt: LastAttempt | null;
  children: React.ReactNode;
}) {
  const scenario = task.contextScenario || scenarioForTask(task);
  const instruction = task.instructionText || instructionForTask(task);
  const hasTranslation = Boolean(task.translation?.trim());

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-950">
            <Building2 className="size-4" />
            {scenario}
          </span>
          <h2 className="mt-5 text-3xl font-black leading-tight tracking-normal text-white sm:text-4xl">
            {instruction}
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-300">{task.hints?.[0]}</p>
        </div>
        <StatePill state={state} />
      </div>

      <div className="mt-6 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
        <p className="font-mono text-xs uppercase tracking-wide text-cyan-200">
          Contexto em portugues
        </p>
        <p className="mt-2 text-base leading-7 text-slate-100">
          {hasTranslation
            ? task.translation
            : "Voce esta em uma situacao real de trabalho. Responda de forma curta, clara e natural em ingles."}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onReveal}
          disabled={revealed}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 hover:border-cyan-200 disabled:opacity-70 sm:w-auto"
        >
          <Eye className="size-4" />
          {revealed ? "Resposta revelada: XP 0" : "Nao sei o que dizer"}
        </button>
        {revealed ? (
          <p className="text-sm font-medium text-amber-200">
            Sem problema. Leia a frase em voz alta para treinar sem pressao.
          </p>
        ) : null}
      </div>

      {revealed ? (
        <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
          <p className="font-mono text-xs uppercase tracking-wide text-amber-200">
            Resposta esperada
          </p>
          <p className="mt-2 text-xl font-semibold text-white">
            {task.expectedAnswer}
          </p>
        </div>
      ) : null}

      <div className="mt-6">{children}</div>
      {attempt && feedback !== "correct" ? (
        <AttemptDiff attempt={attempt} feedback={feedback} />
      ) : null}
      <FeedbackMessage feedback={feedback} />
    </div>
  );
}

function ListenButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      type="button"
      onClick={onClick}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-4 font-semibold text-slate-950 sm:w-auto"
    >
      <Volume2 className="size-5" />
      {label}
    </motion.button>
  );
}

function MicButton({
  recording,
  onClick,
}: {
  recording: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      animate={recording ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={recording ? { repeat: Infinity, duration: 0.8 } : undefined}
      onClick={onClick}
      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-4 font-semibold text-slate-950 sm:w-auto"
    >
      <Mic className="size-5" />
      {recording ? "Gravando..." : "Gravar resposta"}
    </motion.button>
  );
}

function ActionButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      disabled={disabled}
      onClick={onClick}
      className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-cyan-300 px-4 py-4 font-semibold text-slate-950 disabled:opacity-50 sm:w-auto"
    >
      {children}
    </motion.button>
  );
}

function AttemptDiff({
  attempt,
  feedback,
}: {
  attempt: LastAttempt;
  feedback: Feedback;
}) {
  return (
    <div className="mt-5 rounded-lg border border-amber-300/20 bg-amber-400/10 p-4">
      <p className="font-mono text-xs uppercase tracking-wide text-amber-200">
        {feedback === "almost" ? "Quase certo" : "Compare e ajuste"}
      </p>
      <div className="mt-3 grid gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">
            O que esperavamos
          </p>
          <p className="mt-1 text-lg font-semibold text-emerald-200">
            {attempt.expected}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">
            O que o sistema ouviu
          </p>
          <p className="mt-1 text-lg font-semibold text-red-100">
            {attempt.heard || "Nada detectado"}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatePill({ state }: { state: PracticeState }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-200">
      <Clock className="size-4" />
      {state}
    </span>
  );
}

function Transcript({ text }: { text: string }) {
  return text ? (
    <p className="mt-4 rounded-lg bg-slate-950/60 p-3 text-sm text-slate-300">
      Reconhecido: <span className="font-semibold text-white">{text}</span>
    </p>
  ) : null;
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (feedback === "idle") return null;
  const copy = {
    correct: "Boa. Avancando automaticamente...",
    wrong: "Ainda nao foi dessa vez. Compare abaixo e tente novamente.",
    almost: "Bem perto. Ajuste a frase olhando a comparacao.",
  }[feedback];

  return (
    <motion.p
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-5 rounded-lg border border-white/10 bg-white/10 p-4 text-sm text-slate-100"
    >
      {copy}
    </motion.p>
  );
}

function PracticeShell({
  status,
  children,
}: {
  status: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="grid min-h-[calc(100svh-73px)] place-items-center bg-slate-950 px-4 text-white">
      <div className="rounded-lg border border-white/10 bg-white/10 p-6 text-center backdrop-blur-md">
        <Loader2 className="mx-auto size-7 animate-spin text-cyan-200" />
        <p className="mt-4 text-sm text-slate-200">{status}</p>
        {children}
      </div>
    </section>
  );
}

function useFeedbackSound() {
  const [playDing] = useSound(DING, { volume: 0.45 });
  const [playBuzz] = useSound(BUZZ, { volume: 0.35 });

  return (correct: boolean) => {
    navigator.vibrate?.(correct ? [50] : [30, 40, 30]);
    if (correct) playDing();
    else playBuzz();
  };
}

function validateSpoken(
  task: Task,
  transcript: string,
  revealed: boolean,
  setResult: (feedback: Feedback) => void,
  setAttempt: (attempt: LastAttempt | null) => void,
  feedback: (correct: boolean) => void,
  onSuccess: (task: Task, transcript: string, score: number, xpAward: number) => void,
) {
  if (!transcript.trim()) {
    markSpeechNotHeard(task, setResult, setAttempt, feedback);
    return;
  }

  const score = scoreAnswer(transcript, task);
  const correct = score >= 0.82 || revealed;
  setAttempt({ expected: task.expectedAnswer, heard: transcript });
  setResult(correct ? "correct" : score >= 0.68 ? "almost" : "wrong");
  feedback(correct);
  if (correct) onSuccess(task, transcript, score, revealed ? 0 : 10);
}

function markSpeechNotHeard(
  task: Task,
  setResult: (feedback: Feedback) => void,
  setAttempt: (attempt: LastAttempt | null) => void,
  feedback: (correct: boolean) => void,
) {
  setAttempt({
    expected: task.expectedAnswer,
    heard: "Nao consegui ouvir sua resposta. Verifique o microfone e tente de novo.",
  });
  setResult("wrong");
  feedback(false);
}

function scoreAnswer(input: string, task: Task) {
  const candidates = [task.expectedAnswer, ...task.acceptableAnswers];
  if (candidates.some((answer) => answersMatch(input, answer))) return 1;
  return Math.max(...candidates.map((answer) => similarity(input, answer)));
}

function scenarioForTask(task: Task) {
  if (task.type === TASK_TYPES.RAPID_FIRE) return "Bug Report";
  if (task.type === TASK_TYPES.BLIND_DICTATION) return "Client Request";
  if (task.type === TASK_TYPES.MOCK_INTERVIEW) return "Daily Stand-up";
  return "Code Review";
}

function instructionForTask(task: Task) {
  if (task.type === TASK_TYPES.RAPID_FIRE) return "Traduza para o ingles em 5s:";
  if (task.type === TASK_TYPES.BLIND_DICTATION) return "Ouça e digite o que foi dito:";
  if (task.type === TASK_TYPES.MOCK_INTERVIEW) return "Responda como se estivesse em uma daily:";
  return "Ouça e repita a frase em ingles:";
}

function fireConfetti() {
  void confetti({
    particleCount: 160,
    spread: 80,
    origin: { y: 0.25 },
    colors: ["#67e8f9", "#34d399", "#fbbf24", "#f472b6"],
  });
}
