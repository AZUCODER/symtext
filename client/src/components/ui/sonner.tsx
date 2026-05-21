"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { useTheme } from "@/components/ui/theme-provider"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === "dark"

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          // Default
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          // Success — green
          "--success-bg": dark ? "oklch(0.21 0.05 145)" : "oklch(0.96 0.05 145)",
          "--success-text": dark ? "oklch(0.84 0.13 145)" : "oklch(0.30 0.12 145)",
          "--success-border": dark ? "oklch(0.32 0.08 145)" : "oklch(0.84 0.08 145)",
          // Info — blue
          "--info-bg": dark ? "oklch(0.21 0.04 240)" : "oklch(0.96 0.03 240)",
          "--info-text": dark ? "oklch(0.84 0.11 240)" : "oklch(0.30 0.13 240)",
          "--info-border": dark ? "oklch(0.32 0.07 240)" : "oklch(0.85 0.06 240)",
          // Warning — amber
          "--warning-bg": dark ? "oklch(0.22 0.05 75)" : "oklch(0.97 0.06 85)",
          "--warning-text": dark ? "oklch(0.88 0.14 80)" : "oklch(0.38 0.14 68)",
          "--warning-border": dark ? "oklch(0.33 0.09 80)" : "oklch(0.87 0.10 85)",
          // Error — red (aligns with --destructive)
          "--error-bg": dark ? "oklch(0.22 0.04 27)" : "oklch(0.97 0.03 27)",
          "--error-text": dark ? "oklch(0.84 0.13 27)" : "oklch(0.38 0.18 27)",
          "--error-border": dark ? "oklch(0.32 0.07 27)" : "oklch(0.87 0.07 27)",
          // Shared
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
