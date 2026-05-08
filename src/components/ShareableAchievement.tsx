import { toPng } from "html-to-image";
import { Share2 } from "lucide-react";
import { useRef, useState } from "react";

export function ShareableAchievement({
  title,
  subtitle,
  stat,
}: {
  title: string;
  subtitle: string;
  stat: string;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function share() {
    if (!cardRef.current) return;

    setBusy(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: "#020617",
      });
      setPreview(dataUrl);

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "dev-english-achievement.png", {
        type: "image/png",
      });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title,
          text: subtitle,
          files: [file],
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        ref={cardRef}
        className="mx-auto flex aspect-[9/16] w-full max-w-[220px] flex-col justify-between rounded-lg border border-white/10 bg-slate-950 p-5 text-left shadow-2xl"
      >
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-cyan-200">
            Dev English Coach
          </p>
          <h3 className="mt-4 text-2xl font-bold text-white">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">{subtitle}</p>
        </div>
        <div className="rounded-lg bg-cyan-300 p-4 text-slate-950">
          <p className="font-mono text-xs uppercase">Achievement</p>
          <p className="mt-1 text-3xl font-black">{stat}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void share()}
        disabled={busy}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 disabled:opacity-60"
      >
        <Share2 className="size-4" />
        {busy ? "Gerando..." : "Compartilhar conquista"}
      </button>

      {preview ? (
        <img
          src={preview}
          alt="Previa da conquista"
          className="mt-4 hidden rounded-lg border border-white/10"
        />
      ) : null}
    </div>
  );
}
