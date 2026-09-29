import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(root, "dist")
const templatePath = join(dist, "index.html")

const SITE = "https://rosterme.app"

// Must stay in sync with useSeo() calls in src/pages/*.
const ROUTES = [
  {
    route: "/",
    out: "index.html",
    title:
      "RosterMe - Free Signups for Schools, Volunteer Groups & Community Organizers",
    description:
      "RosterMe is free volunteer scheduling for schools, volunteer groups, and community organizers. Create shifts, share one signup link, and see who's coming. No volunteer accounts needed.",
    robots: "index, follow",
    h1: "Volunteer scheduling, without the spreadsheet chase.",
    body: "RosterMe makes it easy for community organizations to create volunteer shifts, share a signup link, and see who's covering what. No volunteer accounts. No complicated setup.",
  },
  {
    route: "/features",
    out: "features/index.html",
    title: "Features - RosterMe Free Volunteer Scheduling",
    description:
      "See what RosterMe can do: create events and shifts, share one signup link, track coverage, and send automatic reminders. Free for schools and community groups.",
    robots: "index, follow",
    h1: "Every tool you need to run volunteer signups.",
    body: "RosterMe covers the whole journey: build events and shifts, share invite links, and know who's coming. Recurring events, waitlists with auto-promotion, custom signup questions, QR codes, teams, reminders, reports, and more. Volunteers never need an account.",
  },
  {
    route: "/resources",
    out: "resources/index.html",
    title: "Resources - Volunteer Coordination Guides | RosterMe",
    description:
      "Guides, help articles, and volunteer coordination tips for schools, volunteer groups, and community organizers.",
    robots: "index, follow",
    h1: "Resources — coming soon",
    body: "Guides, help articles, and volunteer coordination tips for schools, volunteer groups, and community organizers are on the way. Check back soon.",
  },
  {
    route: "/terms-of-service",
    out: "terms-of-service/index.html",
    title: "Terms of Service - RosterMe",
    description:
      "The rules for organizers running events and participants signing up through RosterMe.",
    robots: "index, follow",
    h1: "Terms of Service",
    body: "Rules for organizers who run events and participants who sign up through a public invite link.",
  },
  {
    route: "/privacy-policy",
    out: "privacy-policy/index.html",
    title: "Privacy Policy - RosterMe",
    description:
      "How RosterMe collects, uses, and protects organizer and participant data.",
    robots: "index, follow",
    h1: "Privacy Policy",
    body: "How RosterMe collects, uses, and protects organizer and participant data. No advertising trackers, no sale of personal data.",
  },
  {
    route: "/404",
    out: "404.html",
    title: "Page Not Found | RosterMe",
    description:
      "The page you are looking for does not exist. Head back to RosterMe to create volunteer shifts and share signup links.",
    robots: "noindex, nofollow",
    h1: "Page not found",
    body: "Sorry, the page you are looking for does not exist or has moved.",
  },
]

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function replaceTag(html, pattern, replacement) {
  if (!pattern.test(html)) return html.replace("</head>", `${replacement}\n</head>`)
  return html.replace(pattern, replacement)
}

let template
try {
  template = readFileSync(templatePath, "utf8")
} catch {
  console.error(`prerender: ${templatePath} not found. Run 'vite build' first.`)
  process.exit(1)
}

for (const r of ROUTES) {
  const canonical = `${SITE}${r.route === "/" ? "/" : r.route === "/404" ? "/404" : r.route}`
  let html = template

  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(r.title)}</title>`)
  html = replaceTag(
    html,
    /<meta\s+name="description"\s+content=".*?"\s*\/?>/s,
    `<meta name="description" content="${escapeHtml(r.description)}" />`
  )
  html = replaceTag(
    html,
    /<meta\s+name="robots"\s+content=".*?"\s*\/?>/s,
    `<meta name="robots" content="${r.robots}" />`
  )
  html = replaceTag(
    html,
    /<link\s+rel="canonical"\s+href=".*?"\s*\/?>/s,
    `<link rel="canonical" href="${canonical}" />`
  )
  html = replaceTag(
    html,
    /<meta\s+property="og:title"\s+content=".*?"\s*\/?>/s,
    `<meta property="og:title" content="${escapeHtml(r.title)}" />`
  )
  html = replaceTag(
    html,
    /<meta\s+property="og:description"\s+content=".*?"\s*\/?>/s,
    `<meta property="og:description" content="${escapeHtml(r.description)}" />`
  )
  html = replaceTag(
    html,
    /<meta\s+property="og:url"\s+content=".*?"\s*\/?>/s,
    `<meta property="og:url" content="${canonical}" />`
  )
  html = replaceTag(
    html,
    /<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/s,
    `<meta name="twitter:title" content="${escapeHtml(r.title)}" />`
  )
  html = replaceTag(
    html,
    /<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/s,
    `<meta name="twitter:description" content="${escapeHtml(r.description)}" />`
  )

  // Static snapshot for crawlers without JS. React createRoot clears
  // #root on first render, so JS visitors are unaffected.
  const staticBody = `<div id="root"><main><h1>${escapeHtml(r.h1)}</h1><p>${escapeHtml(r.body)}</p><p><a href="/">RosterMe home</a> · <a href="/features">Features</a> · <a href="/resources">Resources</a></p></main></div>`
  html = html.replace(/<div id="root"><\/div>/, staticBody)

  const outPath = join(dist, r.out)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, html)
  console.log(`prerender: ${r.route} -> ${r.out}`)
}
