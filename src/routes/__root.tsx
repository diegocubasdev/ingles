import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { BookOpenCheck, Moon, Sun, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import { signInWithGoogle } from "../services/userService";
import {
  applyTheme,
  getInitialTheme,
  type ThemeMode,
} from "../services/themeService";

function Login() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError("Erro ao fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3 font-semibold tracking-tight">
            <span className="grid size-10 place-items-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
              <BookOpenCheck className="size-5" aria-hidden="true" />
            </span>
            Intensive English
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="grid size-10 place-items-center rounded-md border border-slate-200 text-slate-700 hover:border-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:border-white"
            aria-label={
              theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"
            }
            title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          >
            {theme === "dark" ? (
              <Sun className="size-5" />
            ) : (
              <Moon className="size-5" />
            )}
          </button>
        </div>
      </header>
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
            {error ? (
              <p className="mt-3 text-xs text-red-700">{error}</p>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function RootLayout() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [user, setUser] = useState<typeof auth.currentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }

  if (loading) {
    return (
      <main className="min-h-svh bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <BookOpenCheck className="mx-auto size-12 text-slate-950 dark:text-white animate-pulse" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Carregando...
          </p>
        </div>
      </main>
    );
  }

  const isAuthenticated =
    user &&
    user.providerData.some((provider) => provider.providerId === "google.com");

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 font-semibold tracking-tight"
          >
            <span className="grid size-10 place-items-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
              <BookOpenCheck className="size-5" aria-hidden="true" />
            </span>
            Intensive English
          </Link>
          <nav className="flex items-center gap-2 text-sm font-medium">
            <Link
              to="/dashboard"
              className="rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              activeProps={{
                className:
                  "rounded-md bg-slate-950 px-3 py-2 text-white dark:bg-white dark:text-slate-950",
              }}
            >
              Roadmap
            </Link>
            <Link
              to="/practice"
              className="rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              activeProps={{
                className:
                  "rounded-md bg-slate-950 px-3 py-2 text-white dark:bg-white dark:text-slate-950",
              }}
            >
              Praticar
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="grid size-10 place-items-center rounded-md border border-slate-200 text-slate-700 hover:border-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:border-white"
              aria-label={
                theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"
              }
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? (
                <Sun className="size-5" />
              ) : (
                <Moon className="size-5" />
              )}
            </button>
          </nav>
        </div>
      </header>
      <Outlet />
    </main>
  );
}

export const rootRoute = createRootRoute({
  component: RootLayout,
});
