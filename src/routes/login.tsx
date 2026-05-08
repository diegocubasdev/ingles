import { BookOpenCheck, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getRedirectResult } from "firebase/auth";
import { auth } from "../services/firebase";
import { signInWithGoogle } from "../services/userService";

export function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for redirect result on component mount
    const checkRedirectResult = async () => {
      try {
        console.log("Checking for redirect result...");
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("Redirect result found, user:", result.user.email);
          // Give Firebase a moment to update state
          await new Promise((resolve) => setTimeout(resolve, 500));
          navigate({ to: "/dashboard" });
        }
      } catch (err) {
        console.error("Redirect result error:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Erro no redirect";
        setError(`Erro ao completar login: ${errorMessage}`);
      }
    };

    checkRedirectResult();
  }, [navigate]);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      console.log("Starting Google sign-in...");
      const user = await signInWithGoogle();
      console.log("Sign-in successful, user:", user);

      // Give Firebase a moment to update auth state before navigating
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log("Navigating to dashboard...");
      navigate({ to: "/dashboard" });
    } catch (err) {
      console.error("Login error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Erro desconhecido";
      // Don't show error if it's the redirect message
      if (!errorMessage.includes("Redirect initiated")) {
        setError(`Erro ao fazer login: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="text-center">
          <BookOpenCheck className="mx-auto size-12 text-slate-950 dark:text-white" />
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
