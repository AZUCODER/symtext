"use client"

import { RegisterForm } from "@/components/auth/register-form"
import { GalleryVerticalEndIcon } from "lucide-react"
import Link from "next/link"

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-5 bg-linear-to-b from-background via-muted/40 to-background p-4 md:p-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 -left-16 h-56 w-56 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -right-20 bottom-8 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <div className="relative z-10 flex w-full max-w-md flex-col gap-5">
        <Link
          href="#"
          className="flex items-center gap-3 self-center font-medium animate-in fade-in-0 slide-in-from-top-2 duration-500"
        >
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEndIcon className="size-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold leading-none">Symtext</span>
            <span className="mt-1 text-xs font-normal leading-none text-muted-foreground">
              Agentic CMS for modern teams
            </span>
          </div>
        </Link>
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-700 delay-150">
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}
