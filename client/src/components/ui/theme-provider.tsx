"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

type ThemeProviderProps = {
  children: ReactNode
}

type Theme = "light" | "dark" | "system"

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "light" | "dark"
}

const STORAGE_KEY = "theme"
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light"
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyResolvedTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") {
    return
  }

  const root = document.documentElement

  root.classList.remove("light", "dark")
  root.classList.add(theme)
  root.setAttribute("data-theme", theme)
  root.style.colorScheme = theme
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") {
    return "system"
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system"
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme())
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => getSystemTheme())

  const resolvedTheme: "light" | "dark" = theme === "system" ? systemTheme : theme

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme)

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextTheme)
    }
  }, [])

  useEffect(() => {
    applyResolvedTheme(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onSystemThemeChange = () => {
      setSystemTheme(getSystemTheme())
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return
      }
      const nextTheme = readStoredTheme()
      setThemeState(nextTheme)
    }

    media.addEventListener("change", onSystemThemeChange)
    window.addEventListener("storage", onStorage)

    return () => {
      media.removeEventListener("change", onSystemThemeChange)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
    }),
    [theme, setTheme, resolvedTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}