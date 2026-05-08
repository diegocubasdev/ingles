import { useCallback, useRef, useState } from "react";
import type { PracticeState } from "../types";

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultListLike;
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
      const recognition = new SpeechRecognitionApi();
      recognitionRef.current = recognition;
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      setError(null);
      setTranscript("");

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

      recognition.onerror = () => {
        if (timeoutId) window.clearTimeout(timeoutId);
        setState("idle");
        setError("Nao consegui entender sua fala.");
        resolve(finalTranscript.trim());
      };

      recognition.onend = () => {
        if (timeoutId) window.clearTimeout(timeoutId);
        setState("idle");
        resolve(finalTranscript.trim());
      };

      recognition.start();
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
