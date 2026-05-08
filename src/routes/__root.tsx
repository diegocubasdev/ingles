import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { BookOpenCheck, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyTheme,
  getInitialTheme,
  type ThemeMode,
} from "../services/themeService";

function RootLayout() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
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
