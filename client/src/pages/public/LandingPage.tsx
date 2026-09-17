import { useEffect } from "react"
import { useClerk } from "@clerk/react"
import { useLocation } from "react-router-dom"
import { useSeo } from "@/lib/seo"
import {
  ArrowRight,
  BellRing,
  CalendarPlus,
  Church,
  ClipboardCheck,
  HeartHandshake,
  Inbox,
  MailCheck,
  MapPin,
  MousePointerClick,
  PawPrint,
  Share2,
  ShieldCheck,
  Soup,
  Users,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function useStart() {
  const { openSignUp } = useClerk()
  return () => openSignUp({ fallbackRedirectUrl: "/dashboard" })
}

function CtaButton({
  children,
  variant = "default",
  size = "lg",
  className,
}: {
  children: React.ReactNode
  variant?: "default" | "outline" | "secondary"
  size?: "default" | "lg"
  className?: string
}) {
  const start = useStart()
  return (
    <Button
      variant={variant}
      size={size}
      onClick={start}
      className={className}
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </Button>
  )
}

const flowSteps = [
  {
    icon: CalendarPlus,
    label: "Create",
    text: "Set up your event and shifts",
  },
  {
    icon: Share2,
    label: "Share",
    text: "Send one signup link",
  },
  {
    icon: MousePointerClick,
    label: "Sign up",
    text: "Volunteers pick a shift",
  },
  {
    icon: ClipboardCheck,
    label: "Covered",
    text: "Watch the roster fill up",
  },
]

function FlowStrip() {
  return (
    <div
      aria-label="How RosterMe works at a glance"
      className="mt-10 flex flex-col gap-2 sm:flex-row sm:items-stretch"
    >
      {flowSteps.map((step, i) => (
        <div key={step.label} className="flex flex-1 items-center gap-2">
          <div className="flex flex-1 items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <step.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm leading-tight font-semibold">
                {i + 1}. {step.label}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {step.text}
              </span>
            </span>
          </div>
          {i < flowSteps.length - 1 && (
            <ArrowRight
              aria-hidden
              className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block"
            />
          )}
        </div>
      ))}
    </div>
  )
}

const organizerShifts = [
  {
    label: "Morning",
    time: "09:00-12:00",
    count: "3/6",
    full: false,
    percent: 50,
  },
  {
    label: "Afternoon",
    time: "13:00-16:00",
    count: "6/6",
    full: true,
    percent: 100,
  },
  {
    label: "Collection",
    time: "16:00-18:00",
    count: "2/5",
    full: false,
    percent: 40,
  },
]

function OrganizerMockup() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none overflow-hidden rounded-xl border bg-card shadow-lg select-none"
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        </span>
        <span className="ml-2 truncate text-xs font-medium text-muted-foreground">
          RosterMe · Community Food Bank · Mar 9 - Mar 15
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span
              key={i}
              className={cn(
                "rounded px-1 py-1 text-[10px] font-semibold",
                i === 5
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {d}
            </span>
          ))}
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Saturday Food Drive</p>
            <Badge variant="secondary" className="text-[10px]">
              Sat, Mar 14
            </Badge>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            Community Hall
          </p>
          <div className="mt-2.5 space-y-1.5">
            {organizerShifts.map((s) => (
              <div key={s.label} className="rounded-md border p-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span>
                    <span className="font-medium">{s.label}</span>{" "}
                    <span className="text-muted-foreground">{s.time}</span>
                  </span>
                  <Badge
                    variant={s.full ? "destructive" : "secondary"}
                    className="text-[10px]"
                  >
                    {s.count}
                  </Badge>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      s.full ? "bg-red-500" : "bg-primary"
                    )}
                    style={{ width: `${s.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const volunteerShifts = [
  {
    label: "Morning",
    time: "09:00-12:00",
    count: "3/6",
    full: false,
    selected: true,
  },
  {
    label: "Afternoon",
    time: "13:00-16:00",
    count: "6/6",
    full: true,
    selected: false,
  },
  {
    label: "Collection",
    time: "16:00-18:00",
    count: "2/5",
    full: false,
    selected: false,
  },
]

function VolunteerMockup() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none overflow-hidden rounded-xl border bg-card shadow-lg select-none"
    >
      <div className="space-y-1 border-b px-5 py-4 text-center">
        <p className="text-[11px] font-medium text-muted-foreground">
          Community Food Bank
        </p>
        <p className="text-base font-bold">Saturday Food Drive</p>
        <p className="text-[11px] text-muted-foreground">
          Saturday, March 14 · Community Hall
        </p>
      </div>
      <div className="space-y-2 p-4">
        {volunteerShifts.map((s) => (
          <div
            key={s.label}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs",
              s.selected && "border-primary bg-primary/5",
              s.full && "opacity-60"
            )}
          >
            <span className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full border-2",
                  s.selected ? "border-primary" : "border-muted-foreground/40"
                )}
              >
                {s.selected && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </span>
              <span>
                <span className="font-medium">{s.label}</span>{" "}
                <span className="text-muted-foreground">{s.time}</span>
              </span>
            </span>
            <Badge
              variant={s.full ? "destructive" : "secondary"}
              className="text-[10px]"
            >
              {s.count}
            </Badge>
          </div>
        ))}
        <div className="space-y-2 pt-1">
          <div className="rounded-md border border-input bg-background px-3 py-2 text-xs text-muted-foreground">
            Your name
          </div>
          <div className="rounded-md border border-input bg-background px-3 py-2 text-xs text-muted-foreground">
            Your email
          </div>
          <div className="rounded-md bg-primary px-3 py-2 text-center text-xs font-medium text-primary-foreground">
            Sign up
          </div>
        </div>
      </div>
    </div>
  )
}

const eventDetailShifts = [
  {
    label: "Morning",
    time: "09:00-12:00",
    count: "3/6",
    signups: [
      { name: "Maria Santos", status: "Confirmed" },
      { name: "James Okafor", status: "Confirmed" },
      { name: "Aisha Bello", status: "Confirmed" },
    ],
  },
  {
    label: "Collection",
    time: "16:00-18:00",
    count: "2/5",
    signups: [
      { name: "Priya Nair", status: "Pending" },
      { name: "Sam de Vries", status: "Confirmed" },
    ],
  },
]

function EventDetailMockup() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none overflow-hidden rounded-xl border bg-card shadow-lg select-none"
    >
      <div className="space-y-0.5 border-b px-5 py-4">
        <p className="text-base font-bold">Saturday Food Drive</p>
        <p className="text-[11px] text-muted-foreground">
          Sat, Mar 14 · Community Hall
        </p>
      </div>
      <div className="space-y-2 p-4">
        {eventDetailShifts.map((shift) => (
          <div key={shift.label} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span>
                <span className="font-medium">{shift.label}</span>{" "}
                <span className="text-muted-foreground">{shift.time}</span>
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {shift.count}
              </Badge>
            </div>
            <div className="mt-2 space-y-1.5">
              {shift.signups.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs"
                >
                  <span className="truncate font-medium">{s.name}</span>
                  <Badge
                    variant={s.status === "Confirmed" ? "default" : "outline"}
                    className={cn(
                      "shrink-0 text-[10px]",
                      s.status !== "Confirmed" &&
                        "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                    )}
                  >
                    {s.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const howItWorks = [
  {
    n: "01",
    title: "Create an event",
    text: "Set up your event, add the shifts you need, and choose how many volunteers each shift can take.",
  },
  {
    n: "02",
    title: "Share the signup link",
    text: "Send the link to your volunteers — or put it on a poster, email, website, or QR code.",
  },
  {
    n: "03",
    title: "Volunteers pick a shift",
    text: "They choose a time, enter their name and email, and they're done. No account required.",
  },
  {
    n: "04",
    title: "See your roster fill up",
    text: "See who's signed up, which shifts are full, and where you still need people.",
  },
]

const organizerPoints = [
  "Who is signed up",
  "How many places are filled",
  "Which shifts are full",
  "Which shifts still need volunteers",
]

const reliability = [
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

const audiences = [
  {
    icon: Soup,
    title: "Food banks",
    text: "Organize morning, afternoon, and collection shifts without a spreadsheet.",
  },
  {
    icon: Users,
    title: "Community groups",
    text: "Create simple rosters for cleanups, outreach, and local events.",
  },
  {
    icon: PawPrint,
    title: "Animal shelters",
    text: "Make recurring volunteer opportunities easy to fill.",
  },
  {
    icon: HeartHandshake,
    title: "Charities & nonprofits",
    text: "Give volunteers one simple place to sign up.",
  },
  {
    icon: Church,
    title: "Churches & local organizations",
    text: "Coordinate welcome desks, events, kitchens, and other volunteer teams.",
  },
]

export function LandingPage() {
  useSeo({
    title: "RosterMe - Free Signups for Schools, Volunteer Groups & Community Organizers",
    description:
      "RosterMe is free volunteer scheduling for schools, volunteer groups, and community organizers. Create shifts, share one signup link, and see who's coming. No volunteer accounts needed.",
    path: "/",
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
      <section className="grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-20">
        <div>
          <Badge variant="secondary" className="mb-4">
            Built for community organizations
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Volunteer scheduling, without the spreadsheet chase.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            RosterMe makes it easy for community organizations to create
            volunteer shifts, share a signup link, and see who&rsquo;s covering
            what.
          </p>
          <p className="mt-3 font-medium">
            No volunteer accounts. No complicated setup. No giant management
            platform.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <CtaButton>Create your first roster</CtaButton>
            <Button variant="outline" size="lg" asChild>
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
        </div>
        <OrganizerMockup />
      </section>

      <FlowStrip />

      {/* 2. Basic flow */}
      <section id="how-it-works" className="scroll-mt-20 py-16">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-balance">
          From &ldquo;We need volunteers&rdquo; to &ldquo;We&rsquo;re
          covered.&rdquo;
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorks.map((s) => (
            <Card key={s.n} size="sm">
              <CardHeader>
                <span className="text-xs font-bold text-primary">{s.n}</span>
                <CardTitle className="text-sm">{s.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 3. Product proof */}
      <section className="grid items-center gap-10 py-16 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-balance">
            See your whole week at a glance.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Know which shifts are covered and which still need volunteers.
          </p>
        </div>
        <OrganizerMockup />
        <EventDetailMockup />
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-balance">
            Know exactly who&rsquo;s coming.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Open any event to see every signup — who&rsquo;s in which shift and
            whether they&rsquo;ve confirmed. Export the volunteer list when you
            need it on paper.
          </p>
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-balance">
            Signing up takes seconds.
          </h2>
          <p className="mt-3 text-muted-foreground">
            No account. No app. Just pick a shift and enter your details.
          </p>
        </div>
        <VolunteerMockup />
      </section>

      {/* 4. Two-sided explanation */}
      <section className="py-16">
        <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold tracking-tight text-balance">
          Simple for organizers. Even simpler for volunteers.
        </h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>For organizers</CardTitle>
              <p className="text-sm text-muted-foreground">
                RosterMe gives you the tools you actually need to run your
                volunteer schedule. Create events and shifts, share signup
                links, manage signups, and see your coverage at a glance.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm font-medium">You can see:</p>
              <ul className="space-y-2">
                {organizerPoints.map((p) => (
                  <li
                    key={p}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {p}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">
                No spreadsheet gymnastics. No digging through group chats to
                figure out who&rsquo;s coming.
              </p>
              <CtaButton size="default" variant="outline">
                Create your first roster
              </CtaButton>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>For volunteers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="text-base font-medium text-foreground">
                Your volunteers don&rsquo;t need another account to remember.
              </p>
              <p>
                They open the link, choose a shift, enter their name and email,
                and receive a confirmation. They&rsquo;ll also get a reminder
                before their shift, so they don&rsquo;t forget.
              </p>
              <p>Later, the same link lets them view or cancel their signup.</p>
              <p>They can also add the shift straight to their calendar.</p>
              <p className="font-medium text-foreground">That&rsquo;s it.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 5. Core benefit */}
      <section className="mx-auto max-w-3xl py-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          Keep everyone on the same page.
        </h2>
        <p className="mt-4 text-muted-foreground">
          Volunteer coordination shouldn&rsquo;t require chasing people down or
          keeping five different spreadsheets up to date. RosterMe gives your
          team one clear view of every event and every shift.
        </p>
        <div className="mt-6 space-y-1 text-lg font-semibold">
          <p>Know what is covered.</p>
          <p>Know what still needs people.</p>
          <p>Know who is coming.</p>
        </div>
        <p className="mt-6 text-muted-foreground">
          And when someone signs up, they get the information they need
          automatically.
        </p>
      </section>

      {/* 6. Trust / reliability */}
      <section className="py-16">
        <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold tracking-tight text-balance">
          Simple on the outside. Reliable underneath.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          RosterMe is designed to make signup easy without sacrificing the
          things organizers need to trust their roster.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {reliability.map((r) => (
            <Card key={r.title} size="sm">
              <CardHeader>
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <r.icon className="h-4 w-4" />
                </span>
                <CardTitle className="text-sm">{r.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{r.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 7. Why RosterMe */}
      <section className="mx-auto max-w-3xl py-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          Built for community organizations.
        </h2>
        <div className="mt-4 space-y-3 text-muted-foreground">
          <p>You could use a spreadsheet.</p>
          <p>You could keep a signup list in a group chat.</p>
          <p>
            You could use a huge event-management platform with dozens of
            features you don&rsquo;t need.
          </p>
          <p className="text-xl font-semibold text-foreground">
            Or you could use RosterMe.
          </p>
        </div>
        <p className="mt-4 text-muted-foreground">
          RosterMe is focused on one thing: volunteer scheduling.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {[
            "No payroll",
            "No donations",
            "No social feed",
            "No complicated system",
          ].map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-3xl border px-3 py-1 text-xs text-muted-foreground"
            >
              <X className="h-3 w-3" />
              {t}
            </span>
          ))}
        </div>
        <p className="mt-5 font-medium">
          Just a simple way to organise shifts and get people signed up.
        </p>
      </section>

      {/* 8. Target audience */}
      <section className="py-16">
        <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold tracking-tight text-balance">
          Made for the people who make communities happen.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map((a) => (
            <Card key={a.title} size="sm">
              <CardHeader>
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <a.icon className="h-4 w-4" />
                </span>
                <CardTitle className="text-sm">{a.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{a.text}</p>
              </CardContent>
            </Card>
          ))}
          <Card
            size="sm"
            className="flex items-center justify-center border-dashed sm:col-span-2 lg:col-span-1"
          >
            <CardContent>
              <p className="text-center text-sm text-muted-foreground">
                Running something else with shifts to fill? RosterMe will
                probably fit.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 9. Final CTA */}
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
