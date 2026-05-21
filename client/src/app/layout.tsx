import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/components/ui/query-provider";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Script from "next/script";

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
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='theme';var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark'&&t!=='system'){t='system'}var s=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var r=t==='system'?s:t;var d=document.documentElement;d.classList.remove('light','dark');d.classList.add(r);d.setAttribute('data-theme',r);d.style.colorScheme=r}catch(e){}})();`,
          }}
        />
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
