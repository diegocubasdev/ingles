import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Mic, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ShareableAchievement } from "../components/ShareableAchievement";
import { useAdvancedSpeech } from "../hooks/useAdvancedSpeech";
import { normalizeAnswer } from "../services/textUtils";

const shorts = [
  {
    id: "dQw4w9WgXcQ",
    title: "Debugging mindset",
    keywords: ["debug", "bug", "issue", "fix"],
  },
  {
    id: "M7lc1UVf-VE",
    title: "API contracts",
    keywords: ["api", "contract", "request", "response"],
  },
  {
    id: "ysz5S6PUM-U",
    title: "Deploy confidence",
    keywords: ["deploy", "pipeline", "release", "rollback"],
  },
];

export function ShortsPage() {
  const feed = useMemo(() => shuffle(shorts), []);

  return (
    <section className="h-[calc(100svh-73px)] snap-y snap-mandatory overflow-y-auto bg-slate-950 text-white">
      <Link
        to="/dashboard"
        className="fixed left-4 top-24 z-20 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm font-semibold backdrop-blur-md"
      >
        <ArrowLeft className="size-4" />
        Dashboard
      </Link>

      {feed.map((video) => (
        <ShortCard key={video.id} video={video} />
      ))}
    </section>
  );
}

function ShortCard({ video }: { video: (typeof shorts)[number] }) {
  const speech = useAdvancedSpeech();
  const [seconds, setSeconds] = useState(15);
  const [recording, setRecording] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    if (!recording || seconds <= 0) return;
    const id = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [recording, seconds]);

  async function summarize() {
    setSeconds(15);
    setRecording(true);
    const transcript = await speech.startRecording(15);
    setRecording(false);
    const spoken = normalizeAnswer(transcript);
    const hits = video.keywords.filter((keyword) =>
      spoken.includes(normalizeAnswer(keyword)),
    ).length;
    setScore(hits);
    navigator.vibrate?.(hits >= 2 ? [50] : [30, 40, 30]);
  }

  return (
    <article className="relative grid h-[calc(100svh-73px)] snap-start place-items-center overflow-hidden bg-slate-950">
      <iframe
        title={video.title}
        src={`https://www.youtube.com/embed/${video.id}?controls=0&modestbranding=1&playsinline=1&rel=0`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        className="h-full w-full"
      />
      <div className="absolute inset-0 bg-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-transparent p-5 pt-24">
        <p className="font-mono text-xs uppercase tracking-wide text-cyan-200">
          Tech Short
        </p>
        <h2 className="mt-2 text-3xl font-semibold">{video.title}</h2>
        <p className="mt-2 text-sm text-slate-300">
          Keywords: {video.keywords.join(", ")}
        </p>
      </div>

      <div className="pointer-events-auto absolute bottom-6 right-4 w-[min(280px,calc(100vw-2rem))] rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 font-mono text-sm text-slate-200">
            <Timer className="size-4" />
            {seconds}s
          </span>
          {score !== null ? (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-200">
              <CheckCircle2 className="size-4" />
              {score}/{video.keywords.length}
            </span>
          ) : null}
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          animate={speech.isRecording ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={speech.isRecording ? { repeat: Infinity, duration: 0.8 } : undefined}
          onClick={() => void summarize()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 font-semibold text-slate-950"
        >
          <Mic className="size-4" />
          {recording ? "Gravando resumo..." : "Gravar Resumo"}
        </motion.button>

        {score !== null && score >= 2 ? (
          <div className="mt-4">
            <ShareableAchievement
              title="I summarized a tech short"
              subtitle={`I used ${score} technical keywords in English.`}
              stat={`${score} keywords`}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
