import { Link, useNavigate } from "@tanstack/react-router";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  Info,
  Keyboard,
  Loader2,
  Mic,
  RotateCcw,
  Volume2,
  X,
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

interface PendingCompletion {
  transcript: string;
  score: number;
  xpAward: number;
  correct: boolean;
}

export function PracticePage() {
  const [user, setUser] = useState<User | null>(null);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionXp, setSessionXp] = useState(0);
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
    correct = true,
  ) {
    if (!user || !studyPlan) return;

    await completeTask(user.uid, task, xpAward, {
      transcript,
      score,
      correct,
    });

    const nextSessionXp = sessionXp + xpAward;
    setSessionXp(nextSessionXp);

    if (currentIndex < tasks.length - 1) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    await completeDay(user.uid, studyPlan.currentDay, studyPlan.completedDays);
    fireConfetti();
    const streak = await checkAndUpdateStreak();
    setCompletion({ xp: nextSessionXp, streak });
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
          <button
            type="button"
            onClick={() =>
              showPracticeHelp(
                "Progresso do dia",
                "Mostra em qual tarefa voce esta hoje. A pratica so avanca quando voce decide continuar.",
              )
            }
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-200"
          >
            <Info className="size-4" />
            Como funciona
          </button>
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
      <PracticeHelpToast />
    </section>
  );
}

function TaskRunner({
  task,
  onSuccess,
}: {
  task: Task;
  onSuccess: CompleteTaskHandler;
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
  const [pendingCompletion, setPendingCompletion] = useState<PendingCompletion | null>(null);
  const [manualAnswer, setManualAnswer] = useState("");

  async function record() {
    try {
      setPendingCompletion(null);
      const transcript = await speech.startRecording(10);
      validateSpoken(
        task,
        transcript,
        revealed,
        setResult,
        setAttempt,
        feedback,
        captureCompletion(setPendingCompletion),
      );
    } catch {
      markSpeechNotHeard(task, setResult, setAttempt, feedback);
      setPendingCompletion(null);
    }
  }

  function validateManualAnswer() {
    setPendingCompletion(null);
    validateSpoken(
      task,
      manualAnswer,
      revealed,
      setResult,
      setAttempt,
      feedback,
      captureCompletion(setPendingCompletion),
    );
  }

  function retry() {
    setResult("idle");
    setAttempt(null);
    setPendingCompletion(null);
    setManualAnswer("");
  }

  return (
    <TaskFrame
      task={task}
      state={speech.state}
      feedback={result}
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      attempt={attempt}
      onContinue={
        pendingCompletion
          ? () => completePending(task, pendingCompletion, onSuccess)
          : attempt && result !== "idle"
            ? () => completeWithZero(task, attempt.heard, onSuccess)
          : undefined
      }
      onRetry={result !== "idle" ? retry : undefined}
    >
      <ListenButton label="Ouvir frase em ingles" onClick={() => void speech.speak(task.content, 1)} />
      <MicButton
        recording={speech.isRecording}
        onClick={() => {
          if (speech.isRecording) speech.stopRecording();
          else void record();
        }}
      />
      <Transcript text={speech.transcript} />
      <WordBlockBuilder
        key={`shadowing-blocks-${task.id}`}
        phrase={task.expectedAnswer}
        onChange={setManualAnswer}
      />
      <ManualSpeechFallback
        value={manualAnswer}
        onChange={setManualAnswer}
        onValidate={validateManualAnswer}
        speechError={speech.error}
        canRecognize={speech.canRecognize}
      />
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
  const [pendingCompletion, setPendingCompletion] = useState<PendingCompletion | null>(null);

  function validate() {
    const score = scoreAnswer(answer, task);
    const correct = score >= 0.82 || revealed;
    setAttempt({ expected: task.expectedAnswer, heard: answer });
    setResult(correct ? "correct" : "wrong");
    setPendingCompletion(
      correct
        ? {
            transcript: answer,
            score,
            xpAward: revealed ? 0 : 10,
            correct: true,
          }
        : null,
    );
    feedback(correct);
  }

  function retry() {
    setResult("idle");
    setAttempt(null);
    setPendingCompletion(null);
    setAnswer("");
  }

  return (
    <TaskFrame
      task={task}
      state={speech.state}
      feedback={result}
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      attempt={attempt}
      onContinue={
        pendingCompletion
          ? () => completePending(task, pendingCompletion, onSuccess)
          : attempt && result !== "idle"
            ? () => completeWithZero(task, attempt.heard, onSuccess)
          : undefined
      }
      onRetry={result !== "idle" ? retry : undefined}
    >
      <GrammarFocusTag value={task.grammarFocus} />
      <ListenButton label="Ouvir frase em ingles rapido" onClick={() => void speech.speak(task.content, 1.25)} />
      <div className="mt-6 flex items-center gap-2">
        <label className="flex items-center gap-2 text-base font-semibold text-slate-100">
          <Keyboard className="size-5" />
          Digite aqui o que voce ouviu
        </label>
        <HelpIcon
          title="Resposta digitada"
          message="Digite exatamente a frase em ingles que voce ouviu no audio."
        />
      </div>
      <input
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Ex: I deployed the hotfix."
        className="mt-3 w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-4 text-lg text-white outline-none focus:border-cyan-300"
      />
      <WordBlockBuilder
        key={`dictation-blocks-${task.id}`}
        phrase={task.expectedAnswer}
        onChange={setAnswer}
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
  const [pendingCompletion, setPendingCompletion] = useState<PendingCompletion | null>(null);
  const [manualAnswer, setManualAnswer] = useState("");

  useEffect(() => {
    if (!running || seconds <= 0) return;
    const id = window.setTimeout(() => {
      setSeconds((value) => {
        if (value <= 1) {
          setRunning(false);
          feedback(false);
          setResult("wrong");
          setAttempt({ expected: task.expectedAnswer, heard: "Tempo esgotado" });
          setPendingCompletion(null);
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
    setPendingCompletion(null);
    try {
      const transcript = await speech.startRecording(5);
      setRunning(false);
      validateSpoken(
        task,
        transcript,
        revealed,
        setResult,
        setAttempt,
        feedback,
        captureCompletion(setPendingCompletion),
      );
    } catch {
      setRunning(false);
      markSpeechNotHeard(task, setResult, setAttempt, feedback);
      setPendingCompletion(null);
    }
  }

  function validateManualAnswer() {
    setRunning(false);
    setPendingCompletion(null);
    validateSpoken(
      task,
      manualAnswer,
      revealed,
      setResult,
      setAttempt,
      feedback,
      captureCompletion(setPendingCompletion),
    );
  }

  function retry() {
    setSeconds(5);
    setRunning(false);
    setResult("idle");
    setAttempt(null);
    setPendingCompletion(null);
    setManualAnswer("");
  }

  return (
    <TaskFrame
      task={task}
      state={speech.state}
      feedback={result}
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      attempt={attempt}
      onContinue={
        pendingCompletion
          ? () => completePending(task, pendingCompletion, onSuccess)
          : attempt && result !== "idle"
            ? () => completeWithZero(task, attempt.heard, onSuccess)
          : undefined
      }
      onRetry={result !== "idle" ? retry : undefined}
    >
      <GrammarFocusTag value={task.grammarFocus} />
      <div className="rounded-lg border border-white/10 bg-slate-950/60 p-5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Frase em portugues
          </p>
          <HelpIcon
            title="Frase em portugues"
            message="Esta e a ideia que voce precisa falar em ingles antes do tempo acabar."
          />
        </div>
        <p className="mt-2 text-2xl font-semibold">{task.content}</p>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="grid size-16 place-items-center rounded-full border border-cyan-300 font-mono text-2xl text-cyan-200">
          {seconds}
        </span>
        <MicButton
          recording={speech.isRecording}
          onClick={() => {
            if (speech.isRecording) speech.stopRecording();
            else void start();
          }}
        />
      </div>
      <Transcript text={speech.transcript} />
      <WordBlockBuilder
        key={`rapid-blocks-${task.id}`}
        phrase={task.expectedAnswer}
        onChange={setManualAnswer}
      />
      <ManualSpeechFallback
        value={manualAnswer}
        onChange={setManualAnswer}
        onValidate={validateManualAnswer}
        speechError={speech.error}
        canRecognize={speech.canRecognize}
      />
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
  const [pendingCompletion, setPendingCompletion] = useState<PendingCompletion | null>(null);
  const [manualAnswer, setManualAnswer] = useState("");
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

  function saveManualAnswer() {
    if (!manualAnswer.trim()) return;
    setAnswers((items) => [...items, manualAnswer.trim()]);
    setManualAnswer("");
  }

  async function finish() {
    setLoading(true);
    try {
      const response = await evaluateMockInterview(answers);
      setAiFeedback(response);
      setResult("correct");
      feedback(true);
      setPendingCompletion({
        transcript: answers.join(" "),
        score: 1,
        xpAward: revealed ? 0 : 10,
        correct: true,
      });
    } catch (error) {
      setAiFeedback(error instanceof Error ? error.message : "Feedback indisponivel.");
      setResult("almost");
      setPendingCompletion(null);
    } finally {
      setLoading(false);
    }
  }

  function retryInterview() {
    setAnswers([]);
    setAiFeedback("");
    setResult("idle");
    setPendingCompletion(null);
    setManualAnswer("");
  }

  return (
    <TaskFrame
      task={task}
      state={loading ? "validating" : speech.state}
      feedback={result}
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      attempt={null}
      onContinue={
        pendingCompletion
          ? () => completePending(task, pendingCompletion, onSuccess)
          : result === "almost" && answers.length > 0
            ? () => completeWithZero(task, answers.join(" "), onSuccess)
            : undefined
      }
      onRetry={result !== "idle" ? retryInterview : undefined}
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
          <MicButton
            recording={speech.isRecording}
            onClick={() => {
              if (speech.isRecording) speech.stopRecording();
              else void answerQuestion();
            }}
          />
          <ManualSpeechFallback
            value={manualAnswer}
            onChange={setManualAnswer}
            onValidate={saveManualAnswer}
            speechError={speech.error}
            canRecognize={speech.canRecognize}
            actionLabel="Salvar resposta digitada"
          />
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
  onSuccess: CompleteTaskHandler;
}

type CompleteTaskHandler = (
  task: Task,
  transcript: string,
  score: number,
  xpAward: number,
  correct?: boolean,
) => void;

function TaskFrame({
  task,
  state,
  feedback,
  revealed,
  onReveal,
  attempt,
  onContinue,
  onRetry,
  children,
}: {
  task: Task;
  state: PracticeState;
  feedback: Feedback;
  revealed: boolean;
  onReveal: () => void;
  attempt: LastAttempt | null;
  onContinue?: () => void;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  const scenario = task.contextScenario || scenarioForTask(task);
  const instruction = task.instructionText || instructionForTask(task);
  const hasTranslation = Boolean(task.translation?.trim());

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-white/10 bg-slate-950/40 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-950">
              <Building2 className="size-4" />
              {scenario}
            </span>
            <HelpIcon
              title="Cenario"
              message="Este e o contexto profissional da frase. Use ele para imaginar a situacao real antes de responder."
            />
          </div>
          <h2 className="mt-5 text-3xl font-black leading-tight tracking-normal text-white sm:text-4xl">
            {instruction}
          </h2>
          <div className="mt-3 flex items-start gap-2">
            <p className="text-base leading-7 text-slate-300">{task.hints?.[0]}</p>
            <HelpIcon
              title="Instrucao"
              message="Leia esta linha primeiro. Ela diz exatamente o que voce precisa fazer nesta tarefa."
            />
          </div>
        </div>
        <StatePill state={state} />
        </div>
      </div>

      <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
        <div className="flex items-center gap-2">
          <p className="font-mono text-xs uppercase tracking-wide text-cyan-200">
            Contexto em portugues
          </p>
          <HelpIcon
            title="Contexto em portugues"
            message="Esta parte traduz a situacao para reduzir a duvida. A resposta final ainda deve ser em ingles."
          />
        </div>
        <p className="mt-2 text-base leading-7 text-slate-100">
          {hasTranslation
            ? task.translation
            : "Voce esta em uma situacao real de trabalho. Responda de forma curta, clara e natural em ingles."}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onReveal}
          disabled={revealed}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 hover:border-cyan-200 disabled:opacity-70 sm:w-auto"
        >
          <Eye className="size-4" />
          {revealed ? "Resposta revelada: XP 0" : "Nao sei o que dizer"}
        </button>
        <HelpIcon
          title="Nao sei o que dizer"
          message="Use quando quiser ver a resposta esperada. Voce pode praticar lendo em voz alta, mas essa tarefa fica sem XP."
        />
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
          <HelpIcon
            title="Resposta esperada"
            message="Esta e uma versao natural em ingles. Tente repetir ou adaptar com a mesma ideia."
          />
          <p className="mt-2 text-xl font-semibold text-white">
            {task.expectedAnswer}
          </p>
        </div>
      ) : null}

      <div>{children}</div>
      {attempt && feedback !== "correct" ? (
        <AttemptDiff attempt={attempt} feedback={feedback} />
      ) : null}
      <FeedbackMessage feedback={feedback} />
      {feedback !== "idle" ? (
        <FeedbackActions
          feedback={feedback}
          onRetry={onRetry}
          onContinue={onContinue}
        />
      ) : null}
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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <motion.button
        whileTap={{ scale: 0.95 }}
        type="button"
        onClick={onClick}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-4 font-semibold text-slate-950 sm:w-auto"
      >
        <Volume2 className="size-5" />
        {label}
      </motion.button>
      <HelpIcon
        title="Ouvir frase"
        message="Toque para escutar o audio em ingles antes de responder. Voce pode ouvir quantas vezes quiser."
      />
    </div>
  );
}

function GrammarFocusTag({ value }: { value?: string }) {
  if (!value) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-fuchsia-100">
        Grammar: {value}
      </div>
      <HelpIcon
        title="Foco gramatical"
        message="Este e o ponto de gramatica que a frase treina. Pense nele antes de responder."
      />
    </div>
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
    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        animate={recording ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={recording ? { repeat: Infinity, duration: 0.8 } : undefined}
        onClick={onClick}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-4 font-semibold text-slate-950 sm:w-auto"
      >
        <Mic className="size-5" />
        {recording ? "Parar e validar" : "Gravar resposta"}
      </motion.button>
      <HelpIcon
        title="Gravar resposta"
        message="Toque para abrir o microfone. Quando estiver gravando, toque de novo para parar e validar."
      />
    </div>
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
    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        disabled={disabled}
        onClick={onClick}
        className="inline-flex w-full items-center justify-center rounded-lg bg-cyan-300 px-4 py-4 font-semibold text-slate-950 disabled:opacity-50 sm:w-auto"
      >
        {children}
      </motion.button>
      <HelpIcon
        title="Validar"
        message="Envia sua resposta para a validacao local. A IA nao e chamada para corrigir cada tentativa."
      />
    </div>
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
      <HelpIcon
        title="Comparacao"
        message="Aqui voce ve a frase esperada e o que o sistema entendeu. Use isso para ajustar a proxima tentativa."
      />
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
    <div className="flex shrink-0 items-center gap-2">
      <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-200">
        <Clock className="size-4" />
        {state}
      </span>
      <HelpIcon
        title="Estado da pratica"
        message="Mostra o que o app esta fazendo agora: parado, tocando audio, gravando ou validando."
      />
    </div>
  );
}

function Transcript({ text }: { text: string }) {
  return text ? (
    <div className="mt-4 rounded-lg bg-slate-950/60 p-3 text-sm text-slate-300">
      <div className="flex items-center gap-2">
        <p>
          Reconhecido: <span className="font-semibold text-white">{text}</span>
        </p>
        <HelpIcon
          title="Texto reconhecido"
          message="Este e o texto que o navegador entendeu a partir da sua fala. Se sair errado, tente de novo ou use o fallback digitado."
        />
      </div>
    </div>
  ) : null;
}

function ManualSpeechFallback({
  value,
  onChange,
  onValidate,
  speechError,
  canRecognize,
  actionLabel = "Validar texto digitado",
}: {
  value: string;
  onChange: (value: string) => void;
  onValidate: () => void;
  speechError?: string | null;
  canRecognize: boolean;
  actionLabel?: string;
}) {
  return (
    <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/50 p-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-slate-100">
          {speechError || !canRecognize
            ? "Microfone nao capturou bem?"
            : "Fallback rapido se o audio sair errado"}
        </p>
        <HelpIcon
          title="Fallback digitado"
          message="Use este campo quando o microfone nao entender bem. Ele evita que voce fique travado na tarefa."
        />
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-400">
        Digite o que voce falou para validar ou salvar a tentativa sem ficar travado.
      </p>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ex: I deployed the hotfix."
        className="mt-3 w-full rounded-lg border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-emerald-300"
      />
      <button
        type="button"
        disabled={!value.trim()}
        onClick={onValidate}
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50 sm:w-auto"
      >
        {actionLabel}
      </button>
    </div>
  );
}

interface WordBlock {
  id: string;
  text: string;
}

function WordBlockBuilder({
  phrase,
  onChange,
}: {
  phrase: string;
  onChange: (value: string) => void;
}) {
  const options = useMemo(() => {
    const words = phrase
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);

    return shuffleWords(
      words.map((word, index) => ({
        id: `${index}-${word}`,
        text: word,
      })),
    );
  }, [phrase]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedBlocks = selectedIds
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is WordBlock => Boolean(option));
  const availableBlocks = options.filter((option) => !selectedIds.includes(option.id));

  function updateSelected(nextIds: string[]) {
    setSelectedIds(nextIds);
    const nextText = nextIds
      .map((id) => options.find((option) => option.id === id)?.text)
      .filter(Boolean)
      .join(" ");
    onChange(nextText);
  }

  return (
    <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/50 p-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-slate-100">
          Monte com blocos
        </p>
        <HelpIcon
          title="Blocos de frase"
          message="Use os blocos para montar a frase quando nao entender o audio. Isso nao conta como revelar resposta e nao zera o XP automaticamente."
        />
      </div>
      <div className="mt-3 min-h-14 rounded-lg border border-dashed border-cyan-300/30 bg-cyan-300/5 p-3">
        {selectedBlocks.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedBlocks.map((block) => (
              <button
                key={block.id}
                type="button"
                onClick={() => updateSelected(selectedIds.filter((id) => id !== block.id))}
                className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950"
              >
                {block.text}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Toque nos blocos abaixo para formar a frase.
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {availableBlocks.map((block) => (
          <button
            key={block.id}
            type="button"
            onClick={() => updateSelected([...selectedIds, block.id])}
            className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold text-slate-100 hover:border-cyan-200"
          >
            {block.text}
          </button>
        ))}
      </div>
      {selectedIds.length > 0 ? (
        <button
          type="button"
          onClick={() => updateSelected([])}
          className="mt-3 text-sm font-semibold text-slate-400 hover:text-white"
        >
          Limpar blocos
        </button>
      ) : null}
    </div>
  );
}

function shuffleWords(words: WordBlock[]) {
  const shuffled = [...words];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (feedback === "idle") return null;
  const copy = {
    correct: "Boa. Resposta aceita. Voce pode repetir para fixar ou continuar para a proxima tarefa.",
    wrong: "Ainda nao foi dessa vez. Compare abaixo, tente novamente ou siga sem XP.",
    almost: "Bem perto. Ajuste a frase olhando a comparacao, ou tente mais uma vez antes de continuar.",
  }[feedback];
  const tone =
    feedback === "correct"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-50"
      : "border-amber-300/30 bg-amber-400/10 text-amber-50";

  return (
    <motion.p
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border p-4 text-sm leading-6 ${tone}`}
    >
      {copy}
    </motion.p>
  );
}

function FeedbackActions({
  feedback,
  onRetry,
  onContinue,
}: {
  feedback: Feedback;
  onRetry?: () => void;
  onContinue?: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-white/10 bg-slate-950/50 p-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={!onRetry}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 hover:border-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="size-4" />
          Tentar novamente
        </button>
        <HelpIcon
          title="Tentar novamente"
          message="Limpa o feedback atual e deixa voce repetir a mesma tarefa antes de seguir."
        />
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onContinue}
          disabled={!onContinue}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 ${
            feedback === "correct"
              ? "bg-emerald-300 hover:bg-emerald-200"
              : "bg-amber-300 hover:bg-amber-200"
          }`}
        >
          {feedback === "correct" ? "Continuar" : "Continuar sem XP"}
          <ArrowRight className="size-4" />
        </button>
        <HelpIcon
          title="Continuar"
          message="Marca esta tarefa como concluida e vai para a proxima. Se estiver sem XP, salva apenas como treino feito."
        />
      </div>
    </div>
  );
}

const PRACTICE_HELP_EVENT = "practice-help";

interface PracticeHelpToastMessage {
  title: string;
  message: string;
}

function HelpIcon({
  title,
  message,
}: PracticeHelpToastMessage) {
  return (
    <button
      type="button"
      aria-label={`Ajuda: ${title}`}
      onClick={() => showPracticeHelp(title, message)}
      className="inline-grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/10 text-slate-200 backdrop-blur hover:border-cyan-200 hover:text-cyan-100"
    >
      <Info className="size-4" />
    </button>
  );
}

function showPracticeHelp(title: string, message: string) {
  window.dispatchEvent(
    new CustomEvent<PracticeHelpToastMessage>(PRACTICE_HELP_EVENT, {
      detail: { title, message },
    }),
  );
}

function PracticeHelpToast() {
  const [toast, setToast] = useState<PracticeHelpToastMessage | null>(null);

  useEffect(() => {
    const handleHelp = (event: Event) => {
      setToast((event as CustomEvent<PracticeHelpToastMessage>).detail);
    };

    window.addEventListener(PRACTICE_HELP_EVENT, handleHelp);
    return () => window.removeEventListener(PRACTICE_HELP_EVENT, handleHelp);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(id);
  }, [toast]);

  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          className="fixed inset-x-4 bottom-24 z-[60] mx-auto max-w-md rounded-lg border border-cyan-300/30 bg-slate-950/95 p-4 text-white shadow-2xl shadow-cyan-950/40 backdrop-blur-md sm:bottom-6"
        >
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-cyan-300 text-slate-950">
              <Info className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-cyan-100">{toast.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-200">{toast.message}</p>
            </div>
            <button
              type="button"
              aria-label="Fechar ajuda"
              onClick={() => setToast(null)}
              className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 text-slate-300 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
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
  onSuccess: CompleteTaskHandler,
) {
  if (!transcript.trim()) {
    if (revealed) {
      setAttempt({ expected: task.expectedAnswer, heard: task.expectedAnswer });
      setResult("correct");
      feedback(true);
      onSuccess(task, task.expectedAnswer, 1, 0, true);
      return;
    }

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

function captureCompletion(
  setPendingCompletion: (completion: PendingCompletion | null) => void,
): CompleteTaskHandler {
  return (_task, transcript, score, xpAward, correct = true) => {
    setPendingCompletion({
      transcript,
      score,
      xpAward,
      correct,
    });
  };
}

function completePending(
  task: Task,
  pendingCompletion: PendingCompletion,
  onSuccess: CompleteTaskHandler,
) {
  onSuccess(
    task,
    pendingCompletion.transcript,
    pendingCompletion.score,
    pendingCompletion.xpAward,
    pendingCompletion.correct,
  );
}

function completeWithZero(
  task: Task,
  transcript: string,
  onSuccess: CompleteTaskHandler,
) {
  const cleanTranscript =
    transcript && !transcript.startsWith("Nao consegui ouvir")
      ? transcript
      : "Tentativa concluida sem reconhecimento de audio.";
  onSuccess(task, cleanTranscript, scoreAnswer(cleanTranscript, task), 0, false);
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
