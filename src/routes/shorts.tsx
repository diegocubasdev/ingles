import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Mic, Play, Timer } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ShareableAchievement } from "../components/ShareableAchievement";
import { useAdvancedSpeech } from "../hooks/useAdvancedSpeech";
import { normalizeAnswer } from "../services/textUtils";

interface ShortVideo {
  id: string;
  title: string;
  keywords: string[];
}

const shortsPool: ShortVideo[] = [
  {
    id: "Mc6pS-5ju5s",
    title: "React interview challenge",
    keywords: ["react", "state", "effect", "component"],
  },
  {
    id: "yhUDK_tLdDA",
    title: "JavaScript interview question",
    keywords: ["javascript", "string", "array", "function"],
  },
  {
    id: "w3dUOEqd55c",
    title: "HTML CSS JS mini project",
    keywords: ["html", "css", "javascript", "ui"],
  },
  {
    id: "MNUoe5ZgvT0",
    title: "Navigation animation",
    keywords: ["navigation", "animation", "css", "javascript"],
  },
  {
    id: "8aGhZQkoFbQ",
    title: "JavaScript event loop",
    keywords: ["javascript", "event", "loop", "async"],
  },
  {
    id: "w7ejDZ8SWv8",
    title: "React crash course",
    keywords: ["react", "component", "props", "state"],
  },
  {
    id: "hdI2bqOjy3c",
    title: "JavaScript fundamentals",
    keywords: ["javascript", "dom", "function", "event"],
  },
  {
    id: "fBNz5xF-Kx4",
    title: "Node.js crash course",
    keywords: ["node", "server", "api", "request"],
  },
  {
    id: "Oe421EPjeBE",
    title: "Node and Express API",
    keywords: ["node", "express", "api", "route"],
  },
  {
    id: "pQN-pnXPaVg",
    title: "HTML tutorial",
    keywords: ["html", "layout", "form", "semantic"],
  },
  {
    id: "UB1O30fR-EE",
    title: "HTML crash course",
    keywords: ["html", "tag", "page", "browser"],
  },
  {
    id: "1WmNXEVia8I",
    title: "TypeScript essentials",
    keywords: ["typescript", "type", "interface", "function"],
  },
  {
    id: "Ke90Tje7VS0",
    title: "React basics",
    keywords: ["react", "jsx", "component", "state"],
  },
  {
    id: "PkZNo7MFNFg",
    title: "JavaScript practice",
    keywords: ["javascript", "variable", "object", "array"],
  },
  {
    id: "M7lc1UVf-VE",
    title: "API embed basics",
    keywords: ["api", "embed", "player", "event"],
  },
];

const batchSize = 8;

export function ShortsPage() {
  const firstBatch = useMemo(() => makeBatch(batchSize), []);
  const [feed, setFeed] = useState(firstBatch);

  const appendBatch = useCallback(() => {
    setFeed((items) => [...items, ...makeBatch(batchSize)]);
  }, []);

  function handleScroll(event: React.UIEvent<HTMLElement>) {
    const target = event.currentTarget;
    const distanceFromBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;

    if (distanceFromBottom < 900) {
      appendBatch();
    }
  }

  return (
    <section
      onScroll={handleScroll}
      className="h-[calc(100svh-4rem-6rem)] snap-y snap-mandatory overflow-y-auto bg-slate-950 text-white md:h-[calc(100svh-73px)]"
    >
      <Link
        to="/dashboard"
        className="fixed left-4 top-20 z-20 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm font-semibold backdrop-blur-md md:top-24"
      >
        <ArrowLeft className="size-4" />
        Dashboard
      </Link>

      {feed.map((video, index) => (
        <ShortCard key={`${video.id}-${index}`} video={video} />
      ))}
    </section>
  );
}

function ShortCard({ video }: { video: ShortVideo }) {
  const speech = useAdvancedSpeech();
  const [seconds, setSeconds] = useState(15);
  const [recording, setRecording] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

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
    <article className="relative grid h-[calc(100svh-4rem-6rem)] snap-start place-items-center overflow-hidden bg-slate-950 md:h-[calc(100svh-73px)]">
      <iframe
        title={video.title}
        src={buildEmbedUrl(video.id, playing)}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="h-full w-full"
      />

      {!playing ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="absolute inset-0 z-10 grid place-items-center bg-slate-950/35 text-white backdrop-blur-[1px]"
          aria-label={`Tocar ${video.title}`}
        >
          <span className="grid size-20 place-items-center rounded-full bg-cyan-300 text-slate-950 shadow-2xl shadow-cyan-500/25">
            <Play className="ml-1 size-9 fill-current" />
          </span>
        </button>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-transparent p-5 pt-24">
        <p className="font-mono text-xs uppercase tracking-wide text-cyan-200">
          Tech Short
        </p>
        <h2 className="mt-2 text-3xl font-semibold">{video.title}</h2>
        <p className="mt-2 text-sm text-slate-300">
          Keywords: {video.keywords.join(", ")}
        </p>
      </div>

      <div className="pointer-events-auto absolute bottom-6 right-4 z-20 w-[min(280px,calc(100vw-2rem))] rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur-md">
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
          transition={
            speech.isRecording ? { repeat: Infinity, duration: 0.8 } : undefined
          }
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

function buildEmbedUrl(id: string, playing: boolean) {
  const params = new URLSearchParams({
    controls: "1",
    modestbranding: "1",
    playsinline: "1",
    rel: "0",
    loop: "1",
    playlist: id,
  });

  if (playing) {
    params.set("autoplay", "1");
    params.set("mute", "1");
  }

  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

function makeBatch(size: number) {
  const shuffled = shuffle(shortsPool);
  return Array.from({ length: size }, (_, index) => shuffled[index % shuffled.length]);
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
