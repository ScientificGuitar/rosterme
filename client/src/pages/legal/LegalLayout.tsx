import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED } from "./legal"

export function ContactLine() {
  return (
    <p>
      If you have questions about these terms or your data, contact us at{" "}
      <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="link-primary">
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
      <h2 id={`${id}-heading`} className="section-title">
        {title}
      </h2>
      <div className="legal-body">{children}</div>
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
    <a href={href} target="_blank" rel="noreferrer" className="link-primary">
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
    <div className="shell-legal">
      <Link to="/" className="link-primary text-sm">
        &larr; Back to home
      </Link>
      <h1 className="page-title mt-4 tracking-tight text-balance">{title}</h1>
      <p className="muted mt-2">Last updated: {LEGAL_LAST_UPDATED}</p>
      <p className="legal-body mt-4">{intro}</p>
      {children}
      <p className="muted mt-10 border-t pt-6">
        Also see our{" "}
        <Link to={sibling.to} className="link-primary">
          {sibling.label}
        </Link>
        .
      </p>
    </div>
  )
}
