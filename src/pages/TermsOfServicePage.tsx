import { LegalDocumentLayout } from '../components/LegalDocumentLayout';
import { LEGAL_CONTACT_EMAIL, LEGAL_JURISDICTION, SITE_NAME } from '../legal/config';

export function TermsOfServicePage() {
  return (
    <LegalDocumentLayout title="Terms of Service">
      <section>
        <h2 className="text-lg font-semibold text-gray-900">1. Agreement</h2>
        <p className="mt-3">
          These Terms of Service (“Terms”) govern your access to and use of {SITE_NAME} (the
          “Service”). By creating an account or using the Service, you agree to these Terms. If you do
          not agree, do not use the Service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">2. Description of the Service</h2>
        <p className="mt-3">
          {SITE_NAME} provides tools for businesses to track customers, amounts owed, due dates, and
          related workflows, and to send communications such as email and SMS reminders as you
          initiate from your account. We may modify or discontinue features with reasonable notice
          where practicable.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">3. Accounts and security</h2>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li>You must provide accurate registration information and keep it up to date.</li>
          <li>
            You are responsible for maintaining the confidentiality of your credentials and for all
            activity under your account.
          </li>
          <li>
            Notify us promptly at{' '}
            <a className="text-blue-600 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
              {LEGAL_CONTACT_EMAIL}
            </a>{' '}
            if you suspect unauthorized access.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">4. SMS program (Account Notifications)</h2>
        <p className="mt-3">
          The Service may allow you to send SMS messages to your customers regarding payment and
          account-related reminders. By using SMS features, you represent and warrant that:
        </p>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li>
            You will obtain and maintain all legally required consents and permissions before sending
            SMS to any recipient.
          </li>
          <li>
            Your messages will accurately identify your business and will not be deceptive or
            misleading.
          </li>
          <li>
            You will honor opt-out requests (including the{' '}
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm font-medium text-gray-800">
              STOP
            </span>{' '}
            keyword where applicable for your messaging configuration) promptly and in accordance with
            applicable law and carrier requirements.
          </li>
          <li>
            You will provide a clear way for recipients to get help (for example replying with the{' '}
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm font-medium text-gray-800">
              HELP
            </span>{' '}
            keyword where you configure auto-replies, and/or your business contact details in the
            message).
          </li>
        </ul>
        <p className="mt-3">
          <span className="font-medium text-gray-900">Program description:</span> SMS messages sent
          through {SITE_NAME} are initiated by your business and relate to payment, invoice, or account
          reminders tied to your customer records. Message frequency varies based on your usage.{' '}
          <span className="text-gray-800">Message and data rates may apply.</span>
        </p>
        <p className="mt-3">
          Carrier delivery is not guaranteed. You are responsible for compliance with rules such as
          U.S. A2P 10DLC registration (where applicable), acceptable use policies of messaging
          providers, and all laws in the regions where you send messages.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">5. Email</h2>
        <p className="mt-3">
          Email sent through the Service must comply with applicable anti-spam laws (including
          accurate headers, honoring unsubscribe requests where required, and lawful consent).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">6. Your responsibilities and acceptable use</h2>
        <p className="mt-3">You agree not to:</p>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li>Use the Service for unlawful, harassing, fraudulent, or harmful purposes.</li>
          <li>Send prohibited content (for example illegal content or content violating carrier rules).</li>
          <li>
            Attempt to gain unauthorized access to the Service, other accounts, or underlying systems.
          </li>
          <li>
            Reverse engineer or scrape the Service except to the extent permitted by mandatory law.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">7. Fees and billing</h2>
        <p className="mt-3">
          Paid plans, taxes, and payment processing are handled as presented at checkout (for example
          via our payment processor). Failure to pay may result in suspension or termination of
          access. Unless required otherwise, fees are non-refundable except as stated at purchase.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">8. Intellectual property</h2>
        <p className="mt-3">
          We own the Service, branding, and related intellectual property. Subject to these Terms, we
          grant you a limited, non-exclusive, non-transferable license to use the Service for your
          internal business purposes. You retain ownership of your business data; you grant us a
          license to host and process it as needed to provide the Service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">9. Third-party services</h2>
        <p className="mt-3">
          The Service relies on third-party infrastructure (including hosting, messaging, and
          payments). Your use may be subject to those providers’ terms and policies.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">10. Disclaimers</h2>
        <p className="mt-3 text-[15px] leading-relaxed">
          The Service is provided on an “as is” and “as available” basis, without warranties of any
          kind, whether express or implied, including implied warranties of merchantability, fitness
          for a particular purpose, and non-infringement, to the maximum extent permitted by law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">11. Limitation of liability</h2>
        <p className="mt-3 text-[15px] leading-relaxed">
          To the maximum extent permitted by law, we and our suppliers will not be liable for any
          indirect, incidental, special, consequential, or exemplary damages, or any loss of profits,
          revenue, goodwill, or data. Our aggregate liability for all claims relating to the Service
          will not exceed the amounts you paid us for the Service in the twelve (12) months before
          the claim (or, if no fees applied, one hundred dollars (USD $100)).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">12. Indemnity</h2>
        <p className="mt-3">
          You will defend and indemnify us against claims, damages, losses, and expenses (including
          reasonable legal fees) arising from your use of the Service, your customer data, your
          messages (SMS and email), or your violation of these Terms or applicable law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">13. Suspension and termination</h2>
        <p className="mt-3">
          We may suspend or terminate access if you materially breach these Terms, create security
          or legal risk, or if we are required to by law. You may stop using the Service at any time.
          Provisions that by nature should survive will survive termination.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">14. Governing law</h2>
        <p className="mt-3">
          These Terms are governed by the laws of {LEGAL_JURISDICTION}, without regard to conflict
          of law principles, except where mandatory consumer protections in your country require
          otherwise.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">15. Changes</h2>
        <p className="mt-3">
          We may modify these Terms. We will post the updated Terms on this page and update the “Last
          updated” date. Continued use after changes become effective constitutes acceptance unless
          applicable law requires a different process.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">16. Contact</h2>
        <p className="mt-3">
          Questions about these Terms:{' '}
          <a className="text-blue-600 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
