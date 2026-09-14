import { ComingSoon } from "@/components/ComingSoon"
import { useSeo } from "@/lib/seo"

export function ResourcesPage() {
  useSeo({
    title: "Resources - Volunteer Coordination Guides | RosterMe",
    description:
      "Guides, help articles, and volunteer coordination tips for schools, volunteer groups, and community organizers.",
    path: "/resources",
  })
  return (
    <ComingSoon
      title="Resources — coming soon"
      description="Guides, help articles, and volunteer coordination tips are on the way. Check back soon."
      backTo="/"
      backLabel="Back to home"
    />
  )
}
