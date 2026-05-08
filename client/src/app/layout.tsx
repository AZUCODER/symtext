import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/components/ui/query-provider";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

export const metadata: Metadata = {
  title: "Symtext",
  description: "Agentic CMS for modern teams",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        "font-sans",
        GeistSans.variable,
        GeistMono.variable
      )}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <ThemeProvider>
            <TooltipProvider>
              {children}
              <Toaster position="top-center" richColors closeButton />
            </TooltipProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
