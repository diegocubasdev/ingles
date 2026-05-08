import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Mic, Play, Timer } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShareableAchievement } from "../components/ShareableAchievement";
import { useAdvancedSpeech } from "../hooks/useAdvancedSpeech";
import { normalizeAnswer } from "../services/textUtils";

interface ShortVideo {
  id: string;
  title: string;
  caption: string;
  keywords: string[];
}

interface YoutubeMessage {
  event?: string;
  func?: string;
}

const shortsPool: ShortVideo[] = [
  {
    id: "Mc6pS-5ju5s",
    title: "React interview challenge",
    caption:
      "The speaker is talking about a React concept you may hear in technical interviews.",
    keywords: ["react", "state", "effect", "component"],
  },
  {
    id: "yhUDK_tLdDA",
    title: "JavaScript interview question",
    caption:
      "This short presents a common JavaScript interview-style question.",
    keywords: ["javascript", "string", "array", "function"],
  },
  {
    id: "w3dUOEqd55c",
    title: "HTML CSS JS mini project",
    caption:
      "The video shows a small UI project built with HTML, CSS, and JavaScript.",
    keywords: ["html", "css", "javascript", "ui"],
  },
  {
    id: "MNUoe5ZgvT0",
    title: "Navigation animation",
    caption:
      "The focus here is a navigation animation created for a web interface.",
    keywords: ["navigation", "animation", "css", "javascript"],
  },
  {
    id: "8aGhZQkoFbQ",
    title: "JavaScript event loop",
    caption:
      "This short explains the JavaScript event loop and asynchronous behavior.",
    keywords: ["javascript", "event", "loop", "async"],
  },
  {
    id: "w7ejDZ8SWv8",
    title: "React crash course",
    caption:
      "The video introduces React basics such as components, props, and state.",
    keywords: ["react", "component", "props", "state"],
  },
  {
    id: "hdI2bqOjy3c",
    title: "JavaScript fundamentals",
    caption:
      "This lesson covers JavaScript fundamentals used in everyday frontend work.",
    keywords: ["javascript", "dom", "function", "event"],
  },
  {
    id: "fBNz5xF-Kx4",
    title: "Node.js crash course",
    caption:
      "The speaker is introducing Node.js as a runtime for backend development.",
    keywords: ["node", "server", "api", "request"],
  },
  {
    id: "Oe421EPjeBE",
    title: "Node and Express API",
    caption:
      "This video is about building API routes with Node.js and Express.",
    keywords: ["node", "express", "api", "route"],
  },
  {
    id: "1WmNXEVia8I",
    title: "TypeScript essentials",
    caption:
      "The video highlights TypeScript features such as types and interfaces.",
    keywords: ["typescript", "type", "interface", "function"],
  },
];

const batchSize = 8;

export function ShortsPage() {
  const firstBatch = useMemo(() => makeBatch(batchSize), []);
  const [feed, setFeed] = useState(firstBatch);
  const [soundUnlocked, setSoundUnlocked] = useState(false);

  const appendBatch = useCallback(() => {
    setFeed((items) => [...items, ...makeBatch(batchSize)]);
  }, []);

  function handleScroll(event: React.UIEvent<HTMLElement>) {
    const target = event.currentTarget;
    const distanceFromBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;

    if (distanceFromBottom < 900) appendBatch();
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
        <ShortCard
          key={`${video.id}-${index}`}
          video={video}
          soundUnlocked={soundUnlocked}
          onUnlockSound={() => setSoundUnlocked(true)}
        />
      ))}
    </section>
  );
}

function ShortCard({
  video,
  soundUnlocked,
  onUnlockSound,
}: {
  video: ShortVideo;
  soundUnlocked: boolean;
  onUnlockSound: () => void;
}) {
  const speech = useAdvancedSpeech();
  const cardRef = useRef<HTMLElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const active = useElementOnScreen(cardRef, 0.98);
  const [seconds, setSeconds] = useState(15);
  const [recording, setRecording] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(soundUnlocked);

  useEffect(() => {
    if (!recording || seconds <= 0) return;
    const id = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [recording, seconds]);

  useEffect(() => {
    if (!ready) return;
    if (active && playing) {
      sendYoutubeCommand(iframeRef.current, "playVideo");
    } else {
      sendYoutubeCommand(iframeRef.current, "pauseVideo");
      window.setTimeout(() => {
        setRecording(false);
        setSeconds(15);
      }, 0);
    }
  }, [active, playing, ready]);

  useEffect(() => {
    function handleMessage(event: MessageEvent<string>) {
      if (event.origin !== "https://www.youtube.com") return;

      try {
        const data = JSON.parse(event.data) as YoutubeMessage;
        if (data.event === "onReady") setReady(true);
      } catch {
        // Ignore non-JSON YouTube messages.
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function summarize() {
    sendYoutubeCommand(iframeRef.current, "pauseVideo");
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
    <article
      ref={cardRef}
      className="relative grid h-[calc(100svh-4rem-6rem)] snap-start place-items-center overflow-hidden bg-slate-950 md:h-[calc(100svh-73px)]"
    >
      <iframe
        ref={iframeRef}
        title={video.title}
        src={buildEmbedUrl(video.id)}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="h-full w-full"
      />

      {!playing ? (
        <button
          type="button"
          onClick={() => {
            setPlaying(true);
            onUnlockSound();
          }}
          className="absolute inset-0 z-10 grid place-items-center bg-slate-950/35 text-white backdrop-blur-[1px]"
          aria-label={`Tocar ${video.title}`}
        >
          <span className="grid size-20 place-items-center rounded-full bg-cyan-300 text-slate-950 shadow-2xl shadow-cyan-500/25">
            <Play className="ml-1 size-9 fill-current" />
          </span>
        </button>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-4 z-10 px-4">
        <div className="mx-auto max-w-xl rounded-lg bg-black/70 p-4 text-center shadow-2xl backdrop-blur-md">
          <p className="font-mono text-xs uppercase tracking-wide text-cyan-200">
            English caption
          </p>
          <p className="mt-2 text-lg font-semibold leading-snug text-white">
            {video.caption}
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-transparent p-5 pt-24">
        <p className="font-mono text-xs uppercase tracking-wide text-cyan-200">
          Tech Short
        </p>
        <h2 className="mt-2 text-3xl font-semibold">{video.title}</h2>
        <p className="mt-2 text-sm text-slate-300">
          Keywords: {video.keywords.join(", ")}
        </p>
      </div>

      <div className="pointer-events-auto absolute inset-x-4 bottom-6 z-20 mx-auto max-w-sm rounded-lg border border-white/10 bg-black/50 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 font-mono text-sm text-slate-200">
            <Timer className="size-4" />
            Speaking opcional: {seconds}s
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
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-100 hover:bg-emerald-500 hover:text-slate-950"
        >
          <Mic className="size-5" />
          {recording ? "Gravando treino..." : "Treinar speaking opcional"}
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

function useElementOnScreen(
  ref: React.RefObject<Element | null>,
  threshold: number,
) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) =>
        setVisible(entry.isIntersecting && entry.intersectionRatio >= threshold),
      { threshold: [0, threshold, 1] },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, threshold]);

  return visible;
}

function sendYoutubeCommand(
  iframe: HTMLIFrameElement | null,
  func: "playVideo" | "pauseVideo",
) {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({
      event: "command",
      func,
      args: [],
    }),
    "https://www.youtube.com",
  );
}

function buildEmbedUrl(id: string) {
  const params = new URLSearchParams({
    enablejsapi: "1",
    autoplay: "1",
    controls: "1",
    modestbranding: "1",
    playsinline: "1",
    rel: "0",
    loop: "1",
    playlist: id,
    cc_lang_pref: "en",
    cc_load_policy: "1",
    origin: window.location.origin,
  });

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
