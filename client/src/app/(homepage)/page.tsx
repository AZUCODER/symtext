import CTA from "@/components/(public)/cta";
import Features from "@/components/(public)/features";
import Footer from "@/components/(public)/footer";
import Header from "@/components/(public)/header";
import Hero from "@/components/(public)/hero";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <Hero />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
