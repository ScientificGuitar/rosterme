import { Link } from "react-router-dom"
import { OPERATOR_NAME } from "./legal"
import {
  ContactLine,
  ExternalLink,
  LegalLayout,
  LegalSection,
} from "./LegalLayout"

export function TermsOfServicePage() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro={`Please read these Terms of Service carefully before using ${OPERATOR_NAME}. They explain the rules for organizers who run events and for volunteers who sign up through a public invite link.`}
      sibling={{ to: "/privacy-policy", label: "Privacy Policy" }}
    >
      <LegalSection id="agreement" title="1. Agreement to these terms">
        <p>
          By accessing or using {OPERATOR_NAME}, you agree to be bound by these
          terms. If you do not agree with any part of these terms, do not use
          the service.
        </p>
        <p>
          {OPERATOR_NAME} (“we”, “us”) provides a volunteer scheduling service.
          An <strong>organizer</strong> creates an organization, sets up events
          with time slots, and shares an invite link. A{" "}
          <strong>volunteer</strong> opens that link and signs up for a slot. No
          volunteer account is required. <ContactLine />
        </p>
      </LegalSection>

      <LegalSection id="service" title="2. What the service does">
        <p>For organizers, {OPERATOR_NAME} lets you:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>create an organization and events with volunteer time slots,</li>
          <li>share a public invite link with volunteers,</li>
          <li>
            see who signed up, which slots are full, and where help is still
            needed,
          </li>
          <li>manage or remove signups and export the volunteer list.</li>
        </ul>
        <p>For volunteers, {OPERATOR_NAME} lets you:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>pick a slot and sign up with your name and email address,</li>
          <li>confirm your signup through a link sent to your email,</li>
          <li>
            view or cancel your signup later using the personal manage link in
            your emails.
          </li>
        </ul>
        <p>
          The service is currently free. We may add paid plans or change
          features in the future. If we do, we will update these terms and let
          you know before the change takes effect.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="3. Organizer accounts">
        <p>
          Organizers sign in through our authentication provider,{" "}
          <ExternalLink href="https://clerk.com">Clerk</ExternalLink>. When you
          create an account, you confirm that you are at least 16 years old (or
          the age of digital consent in your country, if higher) and that the
          information you provide is accurate and current.
        </p>
        <p>
          You are responsible for keeping your login details safe and for
          everything done under your account. Do not share your account or let
          someone else sign in as you. Tell us promptly if you think your
          account has been compromised.
        </p>
        <p>
          If you run events for a club, charity, school, or employer, you
          confirm you are allowed to act for them.
        </p>
      </LegalSection>

      <LegalSection id="volunteer-signup" title="4. Volunteer signups">
        <p>
          Volunteers do not need an account. You enter your name and email
          address, and we send a confirmation link to that address. Your spot is
          only confirmed once you click the link. This keeps mistyped or fake
          addresses off the roster.
        </p>
        <p>
          Every confirmation, reminder, and cancellation email contains a
          personal manage link for your signup. Treat it like a password.{" "}
          <strong>
            Anyone with the link can view or cancel your signup.
          </strong>{" "}
          If a newer email has been sent (for example after a reminder), only
          the newest link works.
        </p>
        <p>
          Volunteers must be at least 16 to sign up on their own. Younger
          volunteers may only sign up with a parent or guardian involved.
        </p>
      </LegalSection>

      <LegalSection id="organizer-rules" title="5. Rules for organizers">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Contact people lawfully.</strong> Only invite people you
            have a proper reason to contact. Use volunteer names and emails only
            to run your events. Do not add them to marketing lists or pass the
            roster around.
          </li>
          <li>
            <strong>Describe events honestly.</strong> Keep the title, location,
            date, and slots accurate and up to date. If an event changes or is
            cancelled, tell your volunteers directly.
          </li>
          <li>
            <strong>Ask only for what you need.</strong> The signup form asks
            for name and email. Do not use event text or slot labels to collect
            extra sensitive details such as health information or ID numbers.
          </li>
          <li>
            <strong>Respect cancellations.</strong> When a volunteer cancels,
            the spot opens up. Do not re-add people who cancelled and do not
            chase them about it outside {OPERATOR_NAME}.
          </li>
          <li>
            <strong>Look after exports.</strong> If you download the volunteer
            list, you are responsible for that copy. Keep it safe and delete it
            when you no longer need it.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="volunteer-rules" title="6. Rules for volunteers">
        <ul className="list-disc space-y-1 pl-6">
          <li>Give your real name and an email address you can open.</li>
          <li>Sign up yourself, unless someone asked you to sign them up.</li>
          <li>
            Only take shifts you plan to attend. If plans change, cancel through
            your manage link so someone else can take the spot.
          </li>
          <li>
            Do not submit someone else’s personal details, abusive content, or
            fake signups.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="content" title="7. Content you post">
        <p>
          Organizers are responsible for the event titles, descriptions, slot
          labels, and other material they publish (“your content”). You keep
          your rights in your content, but you confirm you have the right to
          post it and that it does not break the law or infringe someone else’s
          rights. You grant us a worldwide, non-exclusive, royalty-free license
          to host, display, reproduce, and transmit your content only as needed
          to operate and provide the service, including showing invite pages
          and sending service emails.
        </p>
        <p>
          We may remove or hide content that breaks these terms or that we are
          required to remove by law. How public your content is depends on how
          you share the invite link. Anyone with the link can view the event
          page.
        </p>
      </LegalSection>

      <LegalSection id="unacceptable" title="8. What nobody may do">
        <p>You must not:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>use the service for anything unlawful or fraudulent,</li>
          <li>
            harass, threaten, or harm other people through the service, or post
            anything abusive, obscene, defamatory, or hateful,
          </li>
          <li>
            probe, overload, or work around the service, including trying to
            take a full slot, guessing manage links, or scraping invite pages,
          </li>
          <li>send spam, phishing, or harassing messages,</li>
          <li>upload malware or content that infringes someone else’s rights,</li>
          <li>
            use another person’s account, misrepresent who you are, or automate
            access in a way that strains our systems.
          </li>
        </ul>
        <p>
          We may refuse service, remove content, or suspend accounts at our
          discretion when these rules are broken.
        </p>
      </LegalSection>

      <LegalSection id="emails" title="9. Emails about your signup">
        <p>
          Signup confirmations, reminders sent around 24 hours before a shift,
          and cancellation notices are part of the service. They are sent by our
          email provider,{" "}
          <ExternalLink href="https://resend.com">Resend</ExternalLink>, on our
          behalf. By signing up as a volunteer or running events as an
          organizer, you agree to receive these service emails.
        </p>
        <p>We do not send marketing emails to volunteers.</p>
      </LegalSection>

      <LegalSection id="availability" title="10. Availability and accuracy">
        <p>
          We work to keep {OPERATOR_NAME} reliable, including safeguards that
          stop two volunteers taking the last spot at the same time. Still, we
          cannot promise the service will always be uninterrupted or free of
          errors. Event details are written by organizers, not by us, so check
          with the organizer if something looks wrong.
        </p>
        <p>
          We may change, suspend, or remove parts of the service for
          maintenance, security, or legal reasons. Where the impact is
          significant, we will try to give reasonable notice.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="11. Suspension and termination">
        <p>
          Organizers can stop using the service at any time by deleting their
          events and organization or by asking us to delete their account.
          Volunteers can cancel individual signups through their manage link at
          any time. If you want all data in your account removed, contact us and
          we will delete what we hold, subject to legal retention duties.
        </p>
        <p>
          We may suspend or terminate access, including an organizer account or
          a specific event link, with or without prior notice, if these terms
          are breached, if the law requires it, or to protect volunteers,
          organizers, or the service. Where practical, we will explain what
          happened and how to appeal.
        </p>
      </LegalSection>

      <LegalSection id="privacy" title="12. Privacy">
        <p>
          How we collect and use personal data is described in our{" "}
          <Link
            to="/privacy-policy"
            className="font-medium text-primary underline underline-offset-4"
          >
            Privacy Policy
          </Link>
          , which forms part of these terms. By using the service you agree to
          the Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection id="indemnity" title="13. Indemnification">
        <p>
          You agree to defend, indemnify, and hold {OPERATOR_NAME} harmless from
          claims, losses, and expenses (including reasonable legal fees) that
          result from your use of the service, your breach of these terms, or
          content you post.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="14. Disclaimer and liability">
        <p>
          Your use of the service is at your own risk. The service is provided
          on an “as is” and “as available” basis, without warranties of any
          kind, whether express or implied, including implied warranties of
          merchantability, fitness for a particular purpose, and
          non-infringement. {OPERATOR_NAME} coordinates signups. It does not
          employ, insure, or supervise volunteers, and organizers are solely
          responsible for running safe events.
        </p>
        <p>
          To the maximum extent permitted by law, our liability for any claim
          connected to the service is limited to the amounts you paid us in the
          12 months before the claim arose (which is zero while the service is
          free). In no event will we be liable for indirect, incidental,
          special, or consequential damages, including loss of profits or data.
          Nothing here limits liability where the law does not allow it,
          including for death or personal injury caused by negligence, fraud, or
          your statutory consumer and data protection rights.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="15. Changes to these terms">
        <p>
          We may revise these terms at any time. We will post the updated
          version on this page with a new “last updated” date and, where the
          change is significant, give extra notice in the app. By continuing to
          use the service after the changes take effect, you agree to the
          revised terms.
        </p>
      </LegalSection>

      <LegalSection id="general" title="16. General">
        <p>
          If any part of these terms is found unenforceable, the rest still
          applies. If we do not enforce a provision right away, that does not
          mean we waive our right to enforce it later. These terms are the
          entire agreement between you and us for the service.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
