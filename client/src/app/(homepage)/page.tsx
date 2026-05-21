import CTA from "@/components/(public)/cta";
import FAQ from "@/components/(public)/faq";
import Features from "@/components/(public)/features";
import Footer from "@/components/(public)/footer";
import Header from "@/components/(public)/header";
import Hero from "@/components/(public)/hero";
import Testimonials2 from "@/components/(public)/testimonials2";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <div className="container relative flex max-w-full flex-col items-center gap-16 py-10">
        <Hero />
        <Features />
        <Testimonials2 />
        <FAQ />
        <CTA />
        </div>
      <Footer />
    </div>
  );
}
