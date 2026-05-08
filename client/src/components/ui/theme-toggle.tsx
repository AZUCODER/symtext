"use client"

import { useSyncExternalStore } from "react"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

const subscribe = () => () => {}

type ThemeOption = "system" | "light" | "dark"

const THEME_OPTIONS: { value: ThemeOption; icon: React.ElementType; label: string }[] = [
  { value: "system", icon: MonitorIcon, label: "Use system setting" },
  { value: "light", icon: SunIcon, label: "Light mode" },
  { value: "dark", icon: MoonIcon, label: "Dark mode" },
]

type ThemeToggleProps = {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)

  if (!mounted) {
    return null
  }

  // Keep the control system-sensitive: selecting "system" follows the resolved OS mode.
  const activeTheme: ThemeOption =
    theme === "system" ? (resolvedTheme === "dark" ? "dark" : "light") : ((theme as ThemeOption) ?? "light")
  const usingSystemTheme = theme === "system"

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={cn(
        "flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5 shadow-sm",
        className,
      )}
    >
      {THEME_OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = activeTheme === value
        const systemSelected = value === "system" && usingSystemTheme
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              "relative flex h-6 w-6 items-center justify-center rounded transition-all duration-150",
              active
                ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              systemSelected && "text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {systemSelected && (
              <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border border-background bg-emerald-500" />
            )}
          </button>
        )
      })}
    </div>
  )
}