import Footer from "@/components/(public)/footer"
import Header from "@/components/(public)/header"
import Pricing from "@/components/(public)/pricing"
import { getPricingPlans } from "@/lib/api"

export default async function PricingPage() {
  const response = await getPricingPlans()

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="container mx-auto w-full max-w-7xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <Pricing plans={response.plans} />
      </main>
      <Footer />
    </div>
  )
}
