import { Link, Outlet } from "@tanstack/react-router";
import {
  BookOpenCheck,
  Clapperboard,
  LayoutDashboard,
  Mic2,
  Moon,
  Sun,
} from "lucide-react";
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
    <main className="min-h-svh bg-slate-950 pb-24 text-slate-100 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 md:h-[73px]">
          <Link
            to="/dashboard"
            className="flex min-w-0 items-center gap-3 font-semibold tracking-tight"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-slate-950">
              <BookOpenCheck className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 truncate">
              <span className="sm:hidden">Dev English</span>
              <span className="hidden sm:inline">Intensive English</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-2 text-sm font-medium md:flex">
            <NavLink to="/dashboard" icon={<LayoutDashboard className="size-4" />}>
              Roadmap
            </NavLink>
            <NavLink to="/practice" icon={<Mic2 className="size-4" />}>
              Praticar
            </NavLink>
            <NavLink to="/shorts" icon={<Clapperboard className="size-4" />}>
              Shorts
            </NavLink>
          </nav>
          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </header>
      <Outlet />
      <MobileNav />
    </main>
  );
}

function NavLink({
  to,
  icon,
  children,
}: {
  to: "/dashboard" | "/practice" | "/shorts";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-white"
      activeProps={{
        className:
          "inline-flex items-center gap-2 rounded-md bg-cyan-300 px-3 py-2 text-slate-950",
      }}
    >
      {icon}
      {children}
    </Link>
  );
}

function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/90 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 backdrop-blur-md md:hidden">
      <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">
        <MobileNavLink
          to="/dashboard"
          label="Roadmap"
          icon={<LayoutDashboard className="size-5" />}
        />
        <MobileNavLink
          to="/practice"
          label="Praticar"
          icon={<Mic2 className="size-5" />}
        />
        <MobileNavLink
          to="/shorts"
          label="Shorts"
          icon={<Clapperboard className="size-5" />}
        />
      </div>
    </nav>
  );
}

function MobileNavLink({
  to,
  icon,
  label,
}: {
  to: "/dashboard" | "/practice" | "/shorts";
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs font-semibold text-slate-400"
      activeProps={{
        className:
          "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg bg-cyan-300 text-xs font-semibold text-slate-950",
      }}
    >
      {icon}
      <span className="max-w-full truncate px-1">{label}</span>
    </Link>
  );
}
