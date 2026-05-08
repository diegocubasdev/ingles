import { useCallback, useRef, useState } from "react";
import type { PracticeState } from "../types";

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous?: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function useAdvancedSpeech() {
  const [state, setState] = useState<PracticeState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const speak = useCallback((text: string, rate = 1) => {
    return new Promise<void>((resolve, reject) => {
      if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
        const message = "Este navegador nao suporta audio por voz.";
        setError(message);
        reject(new Error(message));
        return;
      }

      setState("preparing_audio");
      setError(null);

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = "en-US";
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.onstart = () => setState("playing");
      utterance.onend = () => {
        setState("idle");
        resolve();
      };
      utterance.onerror = () => {
        const message = "Nao consegui tocar o audio agora.";
        setState("idle");
        setError(message);
        reject(new Error(message));
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const startRecording = useCallback((seconds?: number) => {
    return new Promise<string>((resolve, reject) => {
      const SpeechRecognitionApi =
        window.SpeechRecognition ?? window.webkitSpeechRecognition;

      if (!SpeechRecognitionApi) {
        const message = "Reconhecimento de fala indisponivel neste navegador.";
        setError(message);
        reject(new Error(message));
        return;
      }

      let finalTranscript = "";
      let timeoutId: number | undefined;
      let settled = false;
      const recognition = new SpeechRecognitionApi();
      recognitionRef.current = recognition;
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      setError(null);
      setTranscript("");

      const settle = () => {
        if (settled) return;
        settled = true;
        if (timeoutId) window.clearTimeout(timeoutId);
        recognitionRef.current = null;
        setState("idle");
        resolve(finalTranscript.trim());
      };

      recognition.onstart = () => {
        setState("recording");
        if (seconds) {
          timeoutId = window.setTimeout(() => recognition.stop(), seconds * 1000);
        }
      };

      recognition.onresult = (event) => {
        const transcripts: string[] = [];

        for (let index = 0; index < event.results.length; index += 1) {
          transcripts.push(event.results[index][0]?.transcript ?? "");
        }

        const spoken = transcripts.join(" ").trim();
        finalTranscript = spoken;
        setTranscript(spoken);
      };

      recognition.onerror = (event) => {
        const message =
          event.error === "not-allowed"
            ? "Permita o acesso ao microfone para gravar sua resposta."
            : event.error === "audio-capture"
              ? "Nao encontrei um microfone ativo neste dispositivo."
              : event.error === "no-speech"
                ? "Nao detectei fala. Tente falar um pouco mais perto do microfone."
                : "Nao consegui entender sua fala.";
        setError(message);
        settle();
      };

      recognition.onend = () => {
        settle();
      };

      try {
        recognition.start();
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Nao consegui iniciar a gravacao.";
        setError(message);
        reject(new Error(message));
      }
    });
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return {
    state,
    transcript,
    error,
    isRecording: state === "recording",
    canRecognize: Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition),
    speak,
    startRecording,
    stopRecording,
  };
}
