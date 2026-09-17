import { Link } from "react-router-dom"
import { ArrowRight, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ComingSoonProps {
  title: string
  description?: string
  backTo?: string
  backLabel?: string
}

export function ComingSoon({
  title,
  description = "We're working on this page. Check back soon.",
  backTo = "/",
  backLabel = "Back to home",
}: ComingSoonProps) {
  return (
    <div className="public-narrow flex flex-col items-center px-6 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Clock className="h-6 w-6" />
      </span>
      <h1 className="page-title mt-5 tracking-tight">{title}</h1>
      <p className="muted mt-2">{description}</p>
      <Button asChild className="mt-6">
        <Link to={backTo}>
          {backLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}
