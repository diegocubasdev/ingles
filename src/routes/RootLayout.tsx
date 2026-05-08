import { Link, Outlet } from "@tanstack/react-router";
import { BookOpenCheck, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyTheme,
  getInitialTheme,
  type ThemeMode,
} from "../services/themeService";

export function RootLayout() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }

  return (
    <main className="min-h-svh bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 font-semibold tracking-tight"
          >
            <span className="grid size-10 place-items-center rounded-lg bg-white text-slate-950">
              <BookOpenCheck className="size-5" aria-hidden="true" />
            </span>
            Intensive English
          </Link>
          <nav className="flex items-center gap-2 text-sm font-medium">
            <NavLink to="/dashboard">Roadmap</NavLink>
            <NavLink to="/practice">Praticar</NavLink>
            <NavLink to="/shorts">Shorts</NavLink>
            <button
              type="button"
              onClick={toggleTheme}
              className="grid size-10 place-items-center rounded-md border border-white/10 text-slate-200 hover:border-cyan-200"
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

function NavLink({
  to,
  children,
}: {
  to: "/dashboard" | "/practice" | "/shorts";
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-white"
      activeProps={{
        className: "rounded-md bg-cyan-300 px-3 py-2 text-slate-950",
      }}
    >
      {children}
    </Link>
  );
}
