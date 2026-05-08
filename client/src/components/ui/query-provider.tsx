"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { ReactNode, useState } from "react"

import { makeQueryClient } from "@/lib/react-query"

type QueryProviderProps = {
  children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(makeQueryClient)

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
