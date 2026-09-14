import { ComingSoon } from "@/components/ComingSoon"
import { useSeo } from "@/lib/seo"

export function FeaturesPage() {
  useSeo({
    title: "Features - RosterMe Free Volunteer Scheduling",
    description:
      "See what RosterMe can do: create events and shifts, share one signup link, track coverage, and send automatic reminders. Free for schools and community groups.",
    path: "/features",
  })
  return (
    <ComingSoon
      title="Features — coming soon"
      description="We're putting together a full tour of everything RosterMe can do. Check back soon."
      backTo="/"
      backLabel="Back to home"
    />
  )
}
