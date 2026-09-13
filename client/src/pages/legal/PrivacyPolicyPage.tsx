import { Link } from "react-router-dom"
import { OPERATOR_NAME } from "./legal"
import {
  ContactLine,
  ExternalLink,
  LegalLayout,
  LegalSection,
} from "./LegalLayout"

export function PrivacyPolicyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro={`${OPERATOR_NAME} helps organizations coordinate volunteers: organizers create events with time slots, and volunteers sign up through a public invite link with their name and email. This policy explains what personal data we collect, why, who we share it with — including our processors Clerk (authentication) and Resend (email delivery) — and the rights you have over your data.`}
      sibling={{ to: "/terms-of-service", label: "Terms of Service" }}
    >
      <LegalSection id="who-is-responsible" title="1. Who is responsible">
        <p>
          {OPERATOR_NAME} (“we”, “us”) decides how the service operates and is
          the <strong>data controller</strong> for organizer account data and
          for operating the service. <ContactLine />
        </p>
        <p>
          For volunteer signup data (names, email addresses, and signup status),
          we act as a{" "}
          <strong>
            data processor / service provider on behalf of the organization
          </strong>{" "}
          running the event: the organization decides which events to run and
          who to invite, and we store and email that data only to operate the
          roster for them. The organization is the controller of its volunteer
          roster, and volunteers can exercise their rights against either the
          organization or us — see section 9.
        </p>
      </LegalSection>

      <LegalSection id="data-we-collect" title="2. Data we collect">
        <p>
          <strong>Organizers (via Clerk authentication).</strong> When you
          create an account and sign in, our authentication provider Clerk
          shares your account identity with us: a Clerk user identifier and the
          email address on your account. We also store your organization name
          and the events, time slots, and invite links you create.
        </p>
        <p>
          <strong>Volunteers (no account).</strong> When you sign up through an
          invite link we collect the name and email address you enter, the slot
          you chose, your signup status (pending, confirmed, cancelled, or
          removed), and timestamps (created, confirmed, reminder sent). We store
          a salted SHA-256 hash of your personal manage token — never the token
          itself — so we can recognize your manage link without keeping a copy
          of it.
        </p>
        <p>
          <strong>Email records.</strong> To deliver confirmations, reminders,
          and cancellation notices reliably, each signup email is stored as a
          delivery record (recipient, subject, message body, and any calendar
          `.ics` attachment) until it has been sent.
        </p>
        <p>
          <strong>Technical data.</strong> Our servers and hosting
          infrastructure process standard technical data needed to operate the
          service, such as IP addresses and request logs. We do not use
          advertising trackers and do not sell personal data.
        </p>
      </LegalSection>

      <LegalSection
        id="how-we-use"
        title="3. How we use data and why (GDPR legal bases)"
      >
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>
              Running the roster (contract / legitimate interests, GDPR Art.
              6(1)(b)–(f)).
            </strong>{" "}
            Storing events, slots, and signups; enforcing slot capacity; showing
            organizers their roster.
          </li>
          <li>
            <strong>
              Confirming signups and preventing abuse (legitimate interests,
              Art. 6(1)(f)).
            </strong>{" "}
            Email confirmation links keep mistyped and fake addresses out of
            rosters; manage-token hashes let volunteers manage their own signups
            securely.
          </li>
          <li>
            <strong>
              Sending service emails (contract / consent, Art. 6(1)(a)–(b)).
            </strong>{" "}
            Confirmations, pre-shift reminders, and cancellation notices.
            Volunteers receive these because they asked to sign up; marketing
            emails are never sent to volunteers.
          </li>
          <li>
            <strong>
              Authentication and security (contract / legal obligation, Art.
              6(1)(b)–(c)).
            </strong>{" "}
            Verifying organizer identity through Clerk and keeping accounts
            secure.
          </li>
          <li>
            <strong>Legal compliance (Art. 6(1)(c)).</strong> Retaining records
            where the law requires it and responding to lawful requests.
          </li>
        </ul>
        <p>
          Where consent is the basis (for example reminder emails tied to a
          voluntary signup), you can withdraw it at any time by cancelling the
          signup through your manage link.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="4. Cookies and similar technologies">
        <p>
          We use only cookies that are strictly necessary to operate the service
          — principally Clerk’s session and authentication cookies that keep
          organizers signed in and protect against misuse. We do not set
          advertising or cross-site tracking cookies, and volunteers browsing or
          signing up through a public invite link are not tracked for
          advertising.
        </p>
        <p>
          Details of the cookies Clerk sets are described in{" "}
          <ExternalLink href="https://clerk.com/legal/privacy">
            Clerk’s privacy policy
          </ExternalLink>
          . You can block cookies in your browser, but signing in as an
          organizer will not work without the strictly-necessary ones.
        </p>
      </LegalSection>

      <LegalSection id="sharing" title="5. Who we share data with">
        <p>
          We share personal data only as needed to run the service, and never
          sell it or share it for someone else’s marketing:
        </p>
        <p>
          <strong>Clerk — authentication (processor).</strong> Organizer sign-in
          is handled by Clerk, Inc. (USA). What is shared: your login identity
          (Clerk user ID, email address, session data) so we can verify who you
          are and which organization you own. Clerk processes this under its own{" "}
          <ExternalLink href="https://clerk.com/legal/privacy">
            privacy policy
          </ExternalLink>{" "}
          and makes a data processing addendum and regional notices available
          through its{" "}
          <ExternalLink href="https://clerk.com/legal">legal hub</ExternalLink>.
          Clerk’s data-sharing rules: it does not sell personal data, uses
          sub-processors for infrastructure, and discloses data only as its
          policy describes (to provide the service, for security and legal
          compliance, or with consent).
        </p>
        <p>
          <strong>Resend — email delivery (processor).</strong> Volunteer emails
          are sent by Resend (Plus Five Five, Inc., USA) on our behalf. What is
          shared per email: the recipient address, subject, message body (which
          includes the volunteer’s name, event details, and manage link), and
          any `.ics` calendar attachment. Resend processes this under its{" "}
          <ExternalLink href="https://resend.com/legal/privacy-policy">
            privacy policy
          </ExternalLink>
          , with processor terms in its{" "}
          <ExternalLink href="https://resend.com/legal/dpa">
            Data Processing Addendum
          </ExternalLink>{" "}
          and infrastructure providers listed in its{" "}
          <ExternalLink href="https://resend.com/legal/subprocessors">
            subprocessor list
          </ExternalLink>
          . Resend’s data-sharing rules: it acts on our instructions, does not
          use email content for its own marketing, and retains delivery metadata
          as its policy and DPA describe.
        </p>
        <p>
          <strong>
            Organizers see their own roster (separate controllers).
          </strong>{" "}
          An organizer can see the names, email addresses, and statuses of
          volunteers who signed up for their events, and can export that list.
          Volunteers: by signing up, you understand the organizer running the
          event receives the details you enter. Organizers must use roster
          data only to run their events (see our Terms of Service) and handle
          any copies they export responsibly.
        </p>
        <p>
          <strong>Hosting and infrastructure.</strong> Data is stored in our
          PostgreSQL database wherever the {OPERATOR_NAME} instance is hosted by
          its operator. No other third party receives personal data unless
          required by law or strictly necessary to keep the service running — in
          which case we will inform you if the law allows it.
        </p>
      </LegalSection>

      <LegalSection id="transfers" title="6. International transfers">
        <p>
          Clerk and Resend are based in the United States, so organizer identity
          data and volunteer email content are transferred to and processed in
          the US. Both providers support recognized safeguards for such
          transfers: Clerk participates in the EU–US Data Privacy Framework and
          offers standard contractual clauses (see its{" "}
          <ExternalLink href="https://clerk.com/legal">legal hub</ExternalLink>
          ), and Resend offers standard contractual clauses in its{" "}
          <ExternalLink href="https://resend.com/legal/dpa">
            Data Processing Addendum
          </ExternalLink>
          . Where the service database itself is hosted also determines where
          roster data rests — organizers operating in the EU/UK should take this
          into account for their own records.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="7. How long we keep data">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Volunteer signups</strong> are kept as part of the
            organizer’s roster history until the organizer deletes the event or
            organization, or a deletion request is granted.
          </li>
          <li>
            <strong>Email delivery records</strong> are kept until sent plus a
            short operational window for debugging delivery failures, then
            removed through routine cleanup.
          </li>
          <li>
            <strong>Organizer accounts</strong> (organization name, Clerk user
            ID) are kept while the account exists and removed within a
            reasonable period after deletion, except where the law requires
            longer retention.
          </li>
          <li>
            Exported copies are the organizer’s responsibility — deleting data
            in {OPERATOR_NAME} does not delete copies an organizer previously
            downloaded.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="security" title="8. Security">
        <p>
          We protect personal data with measures including transport encryption,
          organizer ownership checks on every admin request, SHA-256 hashing of
          volunteer manage tokens (so a database copy alone cannot reconstruct
          manage links), and least-access handling of credentials. No system is
          perfectly secure, so if you suspect misuse of a manage link or
          account, cancel or rotate it and contact us promptly.
        </p>
      </LegalSection>

      <LegalSection id="rights-eu-uk" title="9. Your rights (EU/UK GDPR)">
        <p>
          If you are in the EU, EEA, or UK you have the right to{" "}
          <strong>access</strong> your data, <strong>correct</strong> mistakes,{" "}
          <strong>erase</strong> it, <strong>restrict or object</strong> to
          processing, take your data <strong>elsewhere (portability)</strong>,
          and <strong>withdraw consent</strong> where consent applies. You also
          have the right to complain to your supervisory authority.
        </p>
        <p>
          The fastest route for volunteers: open your manage link to review your
          signup, or cancel it to release your spot. For anything else —
          including a copy of your data or deletion of an unconfirmed signup —
          contact us (see section 1) or the organization that ran the event, and
          we will respond within one month. We may need to verify your identity
          (for example by confirming control of the signup email address) before
          acting.
        </p>
      </LegalSection>

      <LegalSection
        id="rights-california"
        title="10. Your rights (California, CCPA/CPRA)"
      >
        <p>
          California residents have the right to <strong>know</strong> what
          personal information we collect, use, and disclose (described in
          sections 2–5 above), to <strong>delete</strong> and{" "}
          <strong>correct</strong> it, and to{" "}
          <strong>non-discrimination</strong> for exercising these rights. To
          summarize for CCPA purposes:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Categories collected:</strong> identifiers (name, email,
            account IDs), commercial-activity-free event participation records,
            and internet/technical data (IP, logs).
          </li>
          <li>
            <strong>Sources:</strong> you (account signup, volunteer form),
            Clerk (organizer identity), and automatically (technical logs).
          </li>
          <li>
            <strong>Purposes:</strong> operating rosters, authentication,
            service emails, security, legal compliance.
          </li>
          <li>
            <strong>Disclosed to:</strong> the event’s organization (its
            roster), Clerk (auth), Resend (email delivery).
          </li>
          <li>
            <strong>Sale/sharing:</strong> we do not sell personal information
            and do not share it for cross-context behavioral advertising, so
            there is nothing to opt out of.
          </li>
        </ul>
        <p>
          To make a request, contact us (see section 1). We will verify it — for
          volunteers, typically by confirming access to the signup email address
          — and respond within the time the law requires. You may use an
          authorized agent with your written permission.
        </p>
      </LegalSection>

      <LegalSection id="children" title="11. Children">
        <p>
          {OPERATOR_NAME} is not directed at children under 16, and volunteers
          under 16 may only sign up with a parent or guardian’s involvement and
          consent (see our{" "}
          <Link
            to="/terms-of-service"
            className="font-medium text-primary underline underline-offset-4"
          >
            Terms of Service
          </Link>
          ). If you believe a child’s data was submitted without proper consent,
          contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="12. Changes to this policy">
        <p>
          If we change this policy materially, we will post the updated version
          on this page with a new “last updated” date and, where the change is
          significant, give additional notice (for example in the app). The
          version in force is the one published here.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
