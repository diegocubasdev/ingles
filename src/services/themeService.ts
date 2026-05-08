export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'intensive-english-theme'

export function getInitialTheme(): ThemeMode {
  const storedTheme = localStorage.getItem(STORAGE_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return 'dark'
}

export function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  localStorage.setItem(STORAGE_KEY, theme)
}

export function initializeTheme() {
  applyTheme(getInitialTheme())
}
