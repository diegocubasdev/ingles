import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  BellOff,
  Flame,
  Loader2,
  LogOut,
  Plus,
  Radio,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { useOfflineSync } from "../hooks/useOfflineSync";
import { auth } from "../services/firebase";
import {
  disableDailyStudyNotifications,
  enableDailyStudyNotifications,
  getNotificationSettings,
  updateDailyStudyNotificationTimes,
} from "../services/notificationService";
import { generateIntensivePlan } from "../services/taskGenerator";
import { getCurrentStudyPlan } from "../services/studyPlanService";
import {
  getAuthUser,
  getOrCreateUser,
  resetPlan,
  timestampToDate,
  updateUserTechStack,
} from "../services/userService";
import {
  PLAN_DAYS,
  TECH_STACK_OPTIONS,
  type PlanType,
  type StudyPlan,
  type TechStack,
  type User,
} from "../types";

const planOptions: Array<{ id: PlanType; label: string }> = [
  { id: "7_days", label: "7 dias" },
  { id: "15_days", label: "15 dias" },
  { id: "30_days", label: "30 dias" },
  { id: "3_months", label: "3 meses" },
  { id: "6_months", label: "6 meses" },
];

export function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState<PlanType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sync = useOfflineSync(user?.uid);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const currentUser = await getOrCreateUser();
      const currentPlan = await getCurrentStudyPlan(currentUser.uid);
      setUser(currentUser);
      setStudyPlan(currentPlan);
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  async function handleTechStackChange(techStack: TechStack) {
    if (!user) return;
    const nextUser = { ...user, techStack };
    setUser(nextUser);
    await updateUserTechStack(user.uid, techStack);
  }

  async function handleGeneratePlan(planType: PlanType) {
    if (!user || !user.techStack || user.activePlan !== null) return;

    setGeneratingPlan(planType);
    setError(null);

    try {
      await generateIntensivePlan(
        user.uid,
        user.currentLevel,
        planType,
        user.techStack,
      );
      await loadDashboard();
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setGeneratingPlan(null);
    }
  }

  if (loading) {
    return <PageShell status="Carregando cockpit..." />;
  }

  if (!user) {
    return <PageShell status={error ?? "Nao foi possivel carregar usuario."} />;
  }

  const hasActivePlan = user.activePlan !== null;

  return (
    <section className="min-h-[calc(100svh-73px)] bg-slate-950 px-4 py-6 text-white sm:px-6 lg:py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/20 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-wide text-cyan-200">
                  Dev English Coach
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                  Speaking para vagas internacionais
                </h1>
              </div>
              <span className="rounded-md bg-emerald-400/15 px-3 py-2 text-sm font-semibold text-emerald-200">
                {user.xp} XP
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              <Badge icon={<Flame className="size-4" />}>
                {user.streakDays ?? 0} dias
              </Badge>
              <Badge icon={<Radio className="size-4" />}>
                {sync.online ? "Online" : "Offline"}
              </Badge>
              {sync.syncing ? <Badge>Sincronizando</Badge> : null}
            </div>

            {hasActivePlan ? (
              <motion.div whileTap={{ scale: 0.97 }}>
                <Link
                  to="/practice"
                  className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-lg bg-cyan-300 px-5 py-5 text-lg font-bold text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-200"
                >
                  Continuar Trilha
                  <ArrowRight className="size-5" />
                </Link>
              </motion.div>
            ) : (
              <p className="mt-5 text-sm leading-6 text-slate-300">
                Escolha sua stack e gere uma trilha em lote. Depois disso, as
                tarefas rodam offline com validacao local.
              </p>
            )}
          </div>

          <AccountCard user={user} onAccountChanged={loadDashboard} />
          <NotificationCard />
        </aside>

        <div className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <TechStackCard
            selected={user.techStack}
            disabled={hasActivePlan}
            onSelect={(techStack) => void handleTechStackChange(techStack)}
          />

          {hasActivePlan ? (
            <ActivePlan user={user} studyPlan={studyPlan} />
          ) : (
            <PlanCard
              disabled={!user.techStack || generatingPlan !== null}
              generatingPlan={generatingPlan}
              onSelectPlan={handleGeneratePlan}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function TechStackCard({
  selected,
  disabled,
  onSelect,
}: {
  selected: TechStack | null;
  disabled: boolean;
  onSelect: (techStack: TechStack) => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-5 backdrop-blur-md">
      <p className="font-mono text-xs uppercase tracking-wide text-cyan-200">
        Onboarding obrigatorio
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">
        Qual e sua stack?
      </h2>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {TECH_STACK_OPTIONS.map((option) => {
          const active = selected === option;
          return (
            <motion.button
              key={option}
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={disabled}
              onClick={() => onSelect(option)}
              className={[
                "rounded-lg border px-4 py-3 text-left font-mono text-sm transition disabled:opacity-60",
                active
                  ? "border-cyan-300 bg-cyan-300 text-slate-950"
                  : "border-white/10 bg-slate-950/50 text-slate-200 hover:border-cyan-200",
              ].join(" ")}
            >
              {option}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function PlanCard({
  disabled,
  generatingPlan,
  onSelectPlan,
}: {
  disabled: boolean;
  generatingPlan: PlanType | null;
  onSelectPlan: (planType: PlanType) => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-cyan-200">
            AI batch only
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Gerar trilha local-first
          </h2>
        </div>
        <Sparkles className="size-7 text-amber-300" />
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {planOptions.map((option) => (
          <motion.button
            key={option.id}
            type="button"
            whileTap={{ scale: 0.95 }}
            disabled={disabled}
            onClick={() => onSelectPlan(option.id)}
            className="rounded-lg border border-white/10 bg-slate-950/60 p-4 text-left hover:border-cyan-200 disabled:opacity-60"
          >
            <span className="font-semibold text-white">{option.label}</span>
            <span className="mt-2 block text-sm text-slate-400">
              {PLAN_DAYS[option.id]} dias, 4 drills/dia
            </span>
            {generatingPlan === option.id ? (
              <Loader2 className="mt-3 size-5 animate-spin text-cyan-200" />
            ) : null}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function ActivePlan({
  user,
  studyPlan,
}: {
  user: User;
  studyPlan: StudyPlan | null;
}) {
  const totalDays = user.activePlan ? PLAN_DAYS[user.activePlan] : 0;
  const completedDays = studyPlan?.completedDays ?? [];
  const progress = totalDays
    ? Math.round((completedDays.length / totalDays) * 100)
    : 0;
  const startDate = timestampToDate(user.planStartDate);

  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-5 backdrop-blur-md">
      <p className="font-mono text-xs uppercase tracking-wide text-cyan-200">
        Trilha ativa
      </p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-white">{progress}%</h2>
          <p className="mt-2 text-sm text-slate-300">
            {completedDays.length}/{totalDays} dias concluidos
            {startDate ? ` desde ${startDate.toLocaleDateString("pt-BR")}` : ""}
          </p>
        </div>
        <Link
          to="/shorts"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 hover:border-cyan-200"
        >
          Tech Shorts
          <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-cyan-300 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function NotificationCard() {
  const [settings, setSettings] = useState(getNotificationSettings);
  const [draftTime, setDraftTime] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enable() {
    setBusy(true);
    setError(null);

    try {
      await enableDailyStudyNotifications();
      setSettings(getNotificationSettings());
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setBusy(false);
    }
  }

  function disable() {
    disableDailyStudyNotifications();
    setSettings(getNotificationSettings());
    setError(null);
  }

  function addTime() {
    const times = updateDailyStudyNotificationTimes([
      ...settings.times,
      draftTime,
    ]);
    setSettings({ ...getNotificationSettings(), times });
  }

  function removeTime(time: string) {
    const times = updateDailyStudyNotificationTimes(
      settings.times.filter((currentTime) => currentTime !== time),
    );
    setSettings({ ...getNotificationSettings(), times });
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-5 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {settings.enabled ? (
          <Bell className="size-5 text-emerald-300" aria-hidden="true" />
        ) : (
          <BellOff className="size-5 text-slate-400" aria-hidden="true" />
        )}
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-cyan-200">
            Push PWA
          </p>
          <h2 className="font-semibold text-white">Lembretes de estudo</h2>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-300">
        Receba lembretes locais nos horarios configurados.
      </p>

      <div className="mt-4 space-y-2">
        {settings.times.map((time) => (
          <div
            key={time}
            className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2"
          >
            <span className="font-mono text-sm font-semibold text-slate-100">
              {time}
            </span>
            <button
              type="button"
              onClick={() => removeTime(time)}
              className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-red-400/10 hover:text-red-200"
              aria-label={`Remover lembrete das ${time}`}
              title="Remover horario"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="time"
          value={draftTime}
          onChange={(event) => setDraftTime(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-3 text-sm font-semibold text-white outline-none focus:border-cyan-300"
        />
        <button
          type="button"
          onClick={addTime}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-3 text-sm font-semibold text-slate-100 hover:border-cyan-200"
          aria-label="Adicionar horario"
          title="Adicionar horario"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {settings.enabled ? (
        <button
          type="button"
          onClick={disable}
          className="mt-4 w-full rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 hover:border-cyan-200"
        >
          Desativar notificacoes
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void enable()}
          disabled={
            busy ||
            settings.permission === "denied" ||
            settings.permission === "unsupported"
          }
          className="mt-4 w-full rounded-lg bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-60"
        >
          {busy ? "Solicitando permissao..." : "Ativar notificacoes"}
        </button>
      )}

      {settings.permission === "denied" ? (
        <p className="mt-3 text-xs leading-5 text-red-200">
          Permissao bloqueada no navegador. Libere notificacoes nas
          configuracoes do site/PWA.
        </p>
      ) : null}
      {settings.permission === "unsupported" ? (
        <p className="mt-3 text-xs leading-5 text-amber-200">
          Este navegador nao suporta notificacoes Web Push.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-xs leading-5 text-red-200">{error}</p>
      ) : null}
    </div>
  );
}

function AccountCard({
  user,
  onAccountChanged,
}: {
  user: User;
  onAccountChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const authUser = getAuthUser();
  const navigate = useNavigate();

  async function logout() {
    setBusy(true);
    try {
      await signOut(auth);
      await navigate({ to: "/login", replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPlan() {
    if (!confirm("Resetar plano e progresso local?")) return;
    setBusy(true);
    try {
      await resetPlan(user.uid);
      await onAccountChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-5 backdrop-blur-md">
      <p className="text-sm text-slate-300">
        {authUser?.email ?? "Conta Google conectada"}
      </p>
      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={() => void handleResetPlan()}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300/30 px-4 py-3 text-sm font-semibold text-red-100 disabled:opacity-60"
        >
          <RotateCcw className="size-4" />
          Resetar plano
        </button>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 disabled:opacity-60"
        >
          <LogOut className="size-4" />
          Sair
        </button>
      </div>
    </div>
  );
}

function Badge({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-slate-950/50 px-3 py-2 text-slate-200">
      {icon}
      {children}
    </span>
  );
}

function PageShell({ status }: { status: string }) {
  return (
    <section className="grid min-h-[calc(100svh-73px)] place-items-center bg-slate-950 px-4 text-white">
      <div className="rounded-lg border border-white/10 bg-white/10 p-6 text-center backdrop-blur-md">
        <Loader2 className="mx-auto size-7 animate-spin text-cyan-200" />
        <p className="mt-4 text-sm text-slate-200">{status}</p>
      </div>
    </section>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Algo saiu errado. Tente novamente.";
}
