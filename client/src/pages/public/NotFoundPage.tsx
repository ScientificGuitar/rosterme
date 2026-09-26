import { Link } from "react-router-dom"
import { ArrowRight, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSeo } from "@/lib/seo"

export function NotFoundPage() {
  useSeo({
    title: "Page Not Found | RosterMe",
    description:
      "The page you are looking for does not exist. Head back to RosterMe to create volunteer shifts and share signup links.",
    path: "/404",
    noindex: true,
  })

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="h-6 w-6" />
      </span>
      <h1 className="mt-5 text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 text-muted-foreground">
        Sorry, the page you are looking for does not exist or has moved.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link to="/">
            Back to home
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/features">See features</Link>
        </Button>
      </div>
    </div>
  )
}
