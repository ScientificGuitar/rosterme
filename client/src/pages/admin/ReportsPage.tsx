import { Link } from "react-router-dom"
import { ArrowRight, BarChart3, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AdminHeader,
  AdminPageBody,
  AdminPageCenter,
  AdminPageShell,
  DataCard,
  DataCardContent,
  DataCardDivider,
  DataCardHeader,
  DataCardTitle,
} from "@/components/ui/layout"

export function ReportsPage() {
  return (
    <AdminPageShell>
      <AdminHeader
        title="Reports"
        subtitle="Attendance and signup insights for your events."
      />
      <AdminPageBody>
        <AdminPageCenter>
          <DataCard>
            <DataCardHeader>
              <DataCardTitle icon={BarChart3}>Reports</DataCardTitle>
            </DataCardHeader>
            <DataCardDivider />
            <DataCardContent className="py-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Clock className="h-6 w-6" />
              </span>
              <p className="mt-4 text-sm font-medium">
                Reporting is still in the works.
              </p>
              <p className="muted mt-1">Check back soon.</p>
              <Button asChild className="mt-6" size="sm">
                <Link to="/dashboard">
                  Back to dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </DataCardContent>
          </DataCard>
        </AdminPageCenter>
      </AdminPageBody>
    </AdminPageShell>
  )
}
