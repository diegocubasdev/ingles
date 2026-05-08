import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getRedirectResult, onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import { signInWithGoogle } from "../services/userService";

export function Login() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    getRedirectResult(auth).catch((err) => {
      console.error("Redirect result error:", err);
      if (mounted) {
        const errorMessage =
          err instanceof Error ? err.message : "Erro no redirect";
        setError(`Erro ao completar login: ${errorMessage}`);
        setLoading(false);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!mounted) return;

      // Precisamos garantir a mesma validação que existe no seu router.tsx
      const hasGoogleProvider = user?.providerData.some(
        (p) => p.providerId === "google.com",
      );

      if (user && hasGoogleProvider) {
        void navigate({ to: "/dashboard" });
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [navigate]);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // O onAuthStateChanged vai detectar a mudança e redirecionar
    } catch (err) {
      console.error("Login error:", err);
      setLoading(false);
      const errorMessage =
        err instanceof Error ? err.message : "Erro desconhecido";
      if (!errorMessage.includes("Redirect initiated")) {
        setError(`Erro ao fazer login: ${errorMessage}`);
      }
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="text-center">
          <img
            src="/pwa-192x192.png"
            alt="Logo do PWA"
            className="mx-auto size-20 rounded-2xl shadow-sm"
          />
          <h1 className="mt-4 text-2xl font-bold text-slate-950 dark:text-white">
            Intensive English
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Entre com sua conta Google para acessar o app.
          </p>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Entrar com Google
          </button>
          {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
