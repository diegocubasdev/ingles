import { Link } from "@tanstack/react-router";
import { ArrowLeft, Captions, ExternalLink, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface BaseShort {
  title: string;
  category: string;
  caption: string;
}

interface YoutubeShort extends BaseShort {
  source: "youtube";
  id: string;
}

interface TikTokShort extends BaseShort {
  source: "tiktok";
  url: string;
}

type ShortVideo = YoutubeShort | TikTokShort;

interface YoutubeMessage {
  event?: string;
}

const shortsPool: ShortVideo[] = [
  {
    source: "youtube",
    id: "DO6kO6qzU-Y",
    title: "Hidden London",
    category: "London",
    caption: "A short look at a unique attraction in London.",
  },
  {
    source: "youtube",
    id: "oCfidHgQbfw",
    title: "New York subway moment",
    category: "New York",
    caption: "Listen to natural English around New York city life.",
  },
  {
    source: "youtube",
    id: "L9NDgAbf5Zc",
    title: "New York news clip",
    category: "News",
    caption: "A short news-style clip about severe weather in New York.",
  },
  {
    source: "youtube",
    id: "gcnnITxws2g",
    title: "NYC weather update",
    category: "News",
    caption: "Practice listening to emergency and city-update vocabulary.",
  },
  {
    source: "youtube",
    id: "wGn4ECfEPxc",
    title: "Los Angeles hotel story",
    category: "Los Angeles",
    caption: "A short clip connected to travel and hospitality in Los Angeles.",
  },
  {
    source: "youtube",
    id: "lvP02fw1klk",
    title: "New York adventure",
    category: "New York",
    caption: "A short travel story from New York with casual spoken English.",
  },
  {
    source: "youtube",
    id: "hTa0Ra-MGeU",
    title: "World tour note",
    category: "Travel",
    caption: "Listen for travel, culture, and personal-update expressions.",
  },
  {
    source: "youtube",
    id: "vtQkut35JEI",
    title: "Relaxing travel spot",
    category: "Europe / Travel",
    caption: "A calmer short for listening to descriptive travel language.",
  },
  {
    source: "youtube",
    id: "OLIJg1U1Lzo",
    title: "Gaming news short",
    category: "Games",
    caption: "A short gaming update for listening to game-news vocabulary.",
  },
  {
    source: "youtube",
    id: "wQH39y2M0Ts",
    title: "Los Angeles event",
    category: "Los Angeles",
    caption: "A short event clip connected to Los Angeles entertainment.",
  },
  {
    source: "youtube",
    id: "hcukS-b-3tY",
    title: "Short travel blog",
    category: "Travel",
    caption: "A short travel-blog style clip with simple descriptive English.",
  },
  {
    source: "youtube",
    id: "RIslc5SGHOs",
    title: "Book and news update",
    category: "News / Updates",
    caption: "Listen for announcement language and update-style English.",
  },
  {
    source: "tiktok",
    url: "https://www.tiktok.com/channel/travel?lang=en",
    title: "TikTok Travel",
    category: "TikTok",
    caption: "Open TikTok travel shorts in English when you want a fresh feed.",
  },
  {
    source: "tiktok",
    url: "https://www.tiktok.com/channel/traveling?lang=en",
    title: "TikTok Traveling",
    category: "TikTok",
    caption: "Open a TikTok feed with short travel videos in English.",
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
          key={`${video.source}-${video.title}-${index}`}
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
  if (video.source === "tiktok") {
    return <TikTokFallbackCard video={video} />;
  }

  return (
    <YoutubeShortCard
      video={video}
      soundUnlocked={soundUnlocked}
      onUnlockSound={onUnlockSound}
    />
  );
}

function YoutubeShortCard({
  video,
  soundUnlocked,
  onUnlockSound,
}: {
  video: YoutubeShort;
  soundUnlocked: boolean;
  onUnlockSound: () => void;
}) {
  const cardRef = useRef<HTMLElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const active = useElementOnScreen(cardRef, 0.98);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(soundUnlocked);

  useEffect(() => {
    if (!ready) return;
    sendYoutubeCommand(
      iframeRef.current,
      active && playing ? "playVideo" : "pauseVideo",
    );
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

  return (
    <article
      ref={cardRef}
      className="relative grid h-[calc(100svh-4rem-6rem)] snap-start place-items-center overflow-hidden bg-slate-950 md:h-[calc(100svh-73px)]"
    >
      <iframe
        ref={iframeRef}
        title={video.title}
        src={buildYoutubeShortEmbedUrl(video.id)}
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

      <CaptionOverlay video={video} />
    </article>
  );
}

function TikTokFallbackCard({ video }: { video: TikTokShort }) {
  return (
    <article className="relative grid h-[calc(100svh-4rem-6rem)] snap-start place-items-center overflow-hidden bg-slate-950 px-5 text-center md:h-[calc(100svh-73px)]">
      <div className="max-w-sm rounded-lg border border-white/10 bg-white/10 p-6 backdrop-blur-md">
        <p className="font-mono text-xs uppercase tracking-wide text-pink-200">
          TikTok
        </p>
        <h2 className="mt-3 text-3xl font-bold">{video.title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {video.caption}
        </p>
        <a
          href={video.url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-pink-400 px-4 py-3 font-bold text-slate-950"
        >
          Abrir TikTok
          <ExternalLink className="size-4" />
        </a>
      </div>
    </article>
  );
}

function CaptionOverlay({ video }: { video: BaseShort }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-4 z-10 px-4">
        <div className="mx-auto max-w-xl rounded-lg bg-black/70 p-4 text-center shadow-2xl backdrop-blur-md">
          <p className="inline-flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-wide text-cyan-200">
            <Captions className="size-4" />
            English listening
          </p>
          <p className="mt-2 text-lg font-semibold leading-snug text-white">
            {video.caption}
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-transparent p-5 pt-24">
        <p className="font-mono text-xs uppercase tracking-wide text-cyan-200">
          {video.category}
        </p>
        <h2 className="mt-2 text-3xl font-semibold">{video.title}</h2>
      </div>
    </>
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

function buildYoutubeShortEmbedUrl(id: string) {
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
  return Array.from(
    { length: size },
    (_, index) => shuffled[index % shuffled.length],
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
