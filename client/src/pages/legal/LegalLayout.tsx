import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED } from "./legal"

export function ContactLine() {
  return (
    <p>
      If you have questions about these terms or your data, contact us at{" "}
      <a
        href={`mailto:${LEGAL_CONTACT_EMAIL}`}
        className="font-medium text-primary underline underline-offset-4"
      >
        {LEGAL_CONTACT_EMAIL}
      </a>
      .
    </p>
  )
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mt-8">
      <h2 id={`${id}-heading`} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-2 space-y-3 text-[15px] leading-7 text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

export function ExternalLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-primary underline underline-offset-4"
    >
      {children}
    </a>
  )
}

export function LegalLayout({
  title,
  intro,
  sibling,
  children,
}: {
  title: string
  intro: string
  sibling: { to: string; label: string }
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        to="/"
        className="text-sm font-medium text-primary underline underline-offset-4"
      >
        &larr; Back to home
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-balance">
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: {LEGAL_LAST_UPDATED}
      </p>
      <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
        {intro}
      </p>
      {children}
      <p className="mt-10 border-t pt-6 text-sm text-muted-foreground">
        Also see our{" "}
        <Link
          to={sibling.to}
          className="font-medium text-primary underline underline-offset-4"
        >
          {sibling.label}
        </Link>
        .
      </p>
    </div>
  )
}
