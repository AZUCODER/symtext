"use client";

import { ThemeToggle } from "@/components/ui/theme-toggle";

export function FooterStatusBar() {
  return (
    <div className="flex flex-col-reverse max-w-screen-2xl mx-auto items-center justify-between gap-3 px-6 pt-3 pb-2 sm:flex-row">
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-sm bg-emerald-500 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-sm bg-emerald-500" />
        </span>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
          All systems normal.
        </span>
      </div>
      {/* Three-way theme switcher */}
      <ThemeToggle />
    </div>
  );
}
