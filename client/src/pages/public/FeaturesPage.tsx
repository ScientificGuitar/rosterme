import { useEffect, type ReactNode } from "react"
import { useAuth, useClerk } from "@clerk/react"
import { useLocation, useNavigate } from "react-router-dom"
import { useSeo } from "@/lib/seo"
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
  History,
  Inbox,
  Layers,
  Link2,
  ListChecks,
  MailCheck,
  MessageSquareText,
  QrCode,
  Repeat,
  Share2,
  ShieldCheck,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function useStart() {
  const { openSignUp } = useClerk()
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()
  return () => {
    if (isSignedIn) navigate("/dashboard")
    else openSignUp({ fallbackRedirectUrl: "/dashboard" })
  }
}

function CtaButton({
  children,
  variant = "default",
  size = "lg",
  className,
}: {
  children: ReactNode
  variant?: "default" | "outline" | "secondary"
  size?: "default" | "lg"
  className?: string
}) {
  const start = useStart()
  return (
    <Button variant={variant} size={size} onClick={start} className={className}>
      {children}
      <ArrowRight className="h-4 w-4" />
    </Button>
  )
}

interface Feature {
  icon: LucideIcon
  title: string
  text: string
}

const eventsFeatures: Feature[] = [
  {
    icon: CalendarPlus,
    title: "Events & time slots",
    text: "Create an event, add the shifts you need, and set how many volunteers each shift can take.",
  },
  {
    icon: Repeat,
    title: "Recurring events",
    text: "Set up daily, weekly, or monthly events once, with a live preview of every occurrence.",
  },
  {
    icon: ListChecks,
    title: "Custom signup questions",
    text: "Collect phone numbers, shift preferences, or any other detail — up to 10 text, dropdown, or phone questions.",
  },
  {
    icon: CalendarDays,
    title: "Calendar & list views",
    text: "See your whole schedule at a glance — a month calendar or a searchable list across all your groups.",
  },
]

const volunteerFeatures: Feature[] = [
  {
    icon: Share2,
    title: "One signup link, no account",
    text: "Volunteers open the link, pick a shift, and enter their name and email. No app, no password.",
  },
  {
    icon: MailCheck,
    title: "Email confirmations",
    text: "A quick confirm through a secure link keeps fake and mistyped addresses out of your roster.",
  },
  {
    icon: UserRoundPlus,
    title: "Waitlists that fill themselves",
    text: "When a shift is full, late volunteers join a waitlist and are promoted automatically the moment a spot opens.",
  },
  {
    icon: ClipboardList,
    title: "Self-service signups",
    text: "The same link lets volunteers view their signup, add it to their calendar, or cancel it themselves.",
  },
]

const shareFeatures: Feature[] = [
  {
    icon: Link2,
    title: "Invite links for every channel",
    text: "Separate links for your poster, Facebook group, and email — with expiry control, instant revoke, and signup attribution so you know what works.",
  },
  {
    icon: QrCode,
    title: "QR codes",
    text: "Turn any invite into a printable QR code for posters and flyers, as PNG or SVG.",
  },
  {
    icon: MessageSquareText,
    title: "Link previews",
    text: "Paste an invite in WhatsApp or Discord and volunteers see a clean preview card with the event name and date.",
  },
]

const teamFeatures: Feature[] = [
  {
    icon: Layers,
    title: "Groups",
    text: "Keep events organized by team, campus, or department — and run them all from one place.",
  },
  {
    icon: Users,
    title: "More than one admin",
    text: "Invite co-organizers with Owner or Admin roles, and share the workload across your group.",
  },
]

const manageFeatures: Feature[] = [
  {
    icon: ClipboardCheck,
    title: "Live roster",
    text: "See every signup with its status — confirmed, pending, or waitlisted — and search them all.",
  },
  {
    icon: BellRing,
    title: "Automatic reminders",
    text: "Volunteers get a friendly reminder about 24 hours before their shift, straight to their inbox.",
  },
  {
    icon: BarChart3,
    title: "Reports & exports",
    text: "Track signups over time, fill rates, and coverage by event — then export to CSV or Excel.",
  },
  {
    icon: History,
    title: "Recent activity",
    text: "See what changed on each event — signups, edits, and waitlist moves — on one timeline.",
  },
]

const reliability: Feature[] = [
  {
    icon: ShieldCheck,
    title: "No accidental overbooking",
    text: "When the last spot is taken, another volunteer can't slip into the same spot at the same time.",
  },
  {
    icon: MailCheck,
    title: "Confirmed signups",
    text: "Volunteers confirm their email through a secure link, helping keep fake or mistyped addresses out of your roster.",
  },
  {
    icon: BellRing,
    title: "Automatic reminders",
    text: "Volunteers get a reminder before their shift, with the event details and a fresh link to manage their signup.",
  },
  {
    icon: Inbox,
    title: "No lost emails",
    text: "Signup and notification records are saved together, so important confirmation emails don't silently disappear when something goes wrong.",
  },
]

function FeatureCard({ icon: Icon, title, text }: Feature) {
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  )
}

function FeatureSection({
  id,
  title,
  lead,
  features,
  columns = 3,
}: {
  id?: string
  title: string
  lead?: string
  features: Feature[]
  columns?: 2 | 3
}) {
  return (
    <section id={id} className="scroll-mt-20 py-16">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-bold tracking-tight text-balance">
          {title}
        </h2>
        {lead && <p className="mt-3 text-muted-foreground">{lead}</p>}
      </div>
      <div
        className={cn(
          "mt-8 grid gap-4",
          columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"
        )}
      >
        {features.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  )
}

export function FeaturesPage() {
  useSeo({
    title: "Features - RosterMe Free Volunteer Scheduling",
    description:
      "See what RosterMe can do: create events and shifts, share one signup link, track coverage, and send automatic reminders. Free for schools and community groups.",
    path: "/features",
  })
  const { hash } = useLocation()

  useEffect(() => {
    if (hash) {
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ behavior: "smooth" })
    }
  }, [hash])

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-20">
      {/* 1. Hero */}
      <section className="mx-auto max-w-3xl py-16 text-center">
        <Badge variant="secondary" className="mb-4">
          Everything in one place
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Every tool you need to run volunteer signups.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          RosterMe covers the whole journey — build an event and its shifts,
          share invite links, and know exactly who&rsquo;s coming. Here&rsquo;s
          the full list.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <CtaButton>Create your first roster</CtaButton>
          <Button variant="outline" size="lg" asChild>
            <a href="#events">
              Explore the features
              <ArrowDown className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* 2. Events & scheduling */}
      <FeatureSection
        id="events"
        title="Events & scheduling"
        lead="Turn an idea into a roster in minutes — without a spreadsheet."
        features={eventsFeatures}
        columns={2}
      />

      {/* 3. Volunteer signup */}
      <FeatureSection
        id="signup"
        title="Volunteer signup with zero friction"
        lead="Your volunteers never have to create an account, download an app, or remember anything."
        features={volunteerFeatures}
        columns={2}
      />

      {/* 4. Sharing & invites */}
      <FeatureSection
        id="invites"
        title="Sharing & invites"
        lead="Make it effortless for volunteers to find, open, and share your event."
        features={shareFeatures}
      />

      {/* 5. People & teams */}
      <FeatureSection
        id="teams"
        title="People & teams"
        lead="Keep every team, campus, or committee running its own rosters without stepping on each other."
        features={teamFeatures}
        columns={2}
      />

      {/* 6. Stay on top */}
      <FeatureSection
        id="manage"
        title="Stay on top of everything"
        lead="Know who's covered, who's missing, and what changed — without chasing anyone down."
        features={manageFeatures}
        columns={2}
      />

      {/* 7. Reliability */}
      <section className="py-16">
        <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold tracking-tight text-balance">
          Simple on the outside. Reliable underneath.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          RosterMe is designed to make signup easy without sacrificing the
          things organizers need to trust their roster.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {reliability.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      {/* 8. Final CTA */}
      <section className="rounded-2xl bg-primary px-6 py-14 text-center text-primary-foreground">
        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-balance">
          Spend less time organizing volunteers.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl opacity-90">
          Create your first event, share the signup link, and let RosterMe
          handle the rest. Your volunteers know where to be. You know
          who&rsquo;s coming. Everyone&rsquo;s on the same page.
        </p>
        <div className="mt-7">
          <CtaButton variant="secondary" className="font-semibold">
            Create your first roster
          </CtaButton>
        </div>
      </section>
    </div>
  )
}
