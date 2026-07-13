import { LegalDocumentLayout } from '../components/LegalDocumentLayout';
import { LEGAL_CONTACT_EMAIL, SITE_NAME } from '../legal/config';

export function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout title="Privacy Policy">
      <section>
        <h2 className="text-lg font-semibold text-gray-900">1. Introduction</h2>
        <p className="mt-3">
          This Privacy Policy describes how {SITE_NAME} (“we”, “us”, or “our”) collects, uses, stores,
          and shares information when you use our website, application, and related services
          (collectively, the “Service”). By using the Service, you agree to this Privacy Policy.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">2. Who we are</h2>
        <p className="mt-3">
          {SITE_NAME} helps businesses manage customer records, payment workflows, and communications
          such as email and SMS reminders. For privacy questions, contact us at{' '}
          <a className="text-blue-600 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">3. Information we collect</h2>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li>
            <strong className="font-medium text-gray-900">Account and authentication.</strong> Email
            address, password (stored in hashed form), session tokens, and similar security data.
          </li>
          <li>
            <strong className="font-medium text-gray-900">Business profile and templates.</strong>{' '}
            Information you add for invoicing and messaging—for example company name, contact name,
            phone, email, country codes for SMS formatting, and your message templates.
          </li>
          <li>
            <strong className="font-medium text-gray-900">Customer records.</strong> Data you enter
            about your customers (such as name, phone number, address fields, amounts owed, due dates,
            and notes) in order to use features of the Service.
          </li>
          <li>
            <strong className="font-medium text-gray-900">Billing.</strong> When you subscribe or pay,
            our payment processor may collect payment method details and transaction metadata. We do
            not receive full payment card numbers.
          </li>
          <li>
            <strong className="font-medium text-gray-900">Technical and usage data.</strong> Standard
            logs and diagnostics (such as IP address, browser type, timestamps, and error reports) as
            needed to operate and secure the Service.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">4. How we use information</h2>
        <p className="mt-3">We use information to:</p>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li>Provide, operate, maintain, and improve the Service.</li>
          <li>Authenticate users and protect account security.</li>
          <li>
            Send service-related communications (for example account emails, password reset messages,
            billing notifications).
          </li>
          <li>
            Deliver messages you initiate through the Service to your customers (including email and
            SMS as configured in your account).
          </li>
          <li>Analyze usage in aggregate to improve reliability and performance.</li>
          <li>Comply with law, respond to lawful requests, and enforce our Terms of Service.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">5. SMS and email delivery</h2>
        <p className="mt-3">
          When you use {SITE_NAME} to send SMS or email to your customers, we transmit content through
          messaging providers (for example Twilio for SMS and an email delivery provider for
          transactional email). Those providers process recipient addresses and message content as
          needed to deliver messages.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">6. SMS and mobile messaging (program disclosures)</h2>
        <p className="mt-3">
          This section applies to text messages sent by merchants through {SITE_NAME} to their
          customers (payment and account-related reminders).
        </p>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li>
            <strong className="font-medium text-gray-900">No sale or sharing of mobile contact data.</strong>{' '}
            We do not sell, rent, or share mobile phone numbers, SMS opt-in data, or consent records
            collected through the Service with third parties or affiliates for their own marketing or
            promotional purposes.
          </li>
          <li>
            <strong className="font-medium text-gray-900">Message frequency.</strong> Message frequency
            varies; it depends on how often a merchant sends reminders from their account (not on a
            fixed schedule from {SITE_NAME}).
          </li>
          <li>
            <strong className="font-medium text-gray-900">Rates.</strong>{' '}
            <span className="text-gray-800">Message and data rates may apply.</span>
          </li>
          <li>
            <strong className="font-medium text-gray-900">Opt-in.</strong> End-users typically opt in
            through their relationship with the merchant (for example by providing a mobile number on
            an invoice, contract, or account form). Merchants must confirm they have permission before
            sending SMS from {SITE_NAME}.
          </li>
          <li>
            <strong className="font-medium text-gray-900">Opt-out and help.</strong> Recipients may opt
            out by following instructions in the message (for example replying{' '}
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm font-medium text-gray-800">
              STOP
            </span>{' '}
            where supported), by contacting the merchant directly, or by emailing{' '}
            <a className="text-blue-600 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
              {LEGAL_CONTACT_EMAIL}
            </a>
            .
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">7. Merchants and end-users</h2>
        <p className="mt-3">
          If you are a business user (“merchant”) and you enter information about your customers into
          the Service, you are responsible for ensuring you have a lawful basis to collect and use
          that information and to send communications to those individuals. Depending on your
          situation, you may act as an independent controller of customer personal information, and
          we may process that information on your behalf to provide the Service. If you need a data
          processing agreement, contact us.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">8. Legal bases (where applicable)</h2>
        <p className="mt-3">
          Where laws such as the GDPR or UK GDPR apply, we rely on appropriate bases such as: (a)
          performance of a contract with you; (b) our legitimate interests in operating and securing
          the Service (balanced against your rights); and (c) consent where we request it and you
          provide it clearly.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">9. Retention</h2>
        <p className="mt-3">
          We retain information for as long as your account is active and as needed to provide the
          Service, comply with legal obligations, resolve disputes, and enforce our agreements.
          Merchant-entered customer data is retained until you delete it or delete your account,
          subject to backup and legal retention requirements.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">10. Security</h2>
        <p className="mt-3">
          We implement reasonable technical and organizational measures designed to protect
          information against unauthorized access, loss, or alteration. No method of transmission
          over the Internet or electronic storage is completely secure.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">11. International transfers</h2>
        <p className="mt-3">
          We may process and store information in countries other than your own, including where our
          service providers operate. Where required, we take steps designed to ensure appropriate
          safeguards.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">12. Your rights</h2>
        <p className="mt-3">
          Depending on your location, you may have rights to access, correct, delete, restrict, or
          object to certain processing of your personal information, and to lodge a complaint with a
          supervisory authority. To exercise rights related to information held in your account, contact{' '}
          <a className="text-blue-600 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
        <p className="mt-3">
          If you received an SMS or email from a {SITE_NAME} merchant and want to opt out, follow the
          instructions in that message (for example replying with{' '}
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm font-medium text-gray-800">
            STOP
          </span>{' '}
          to SMS where supported) or contact the merchant directly.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">13. Children</h2>
        <p className="mt-3">
          The Service is not directed to children under 16, and we do not knowingly collect personal
          information from children under 16. If you believe we have collected such information,
          contact us and we will take appropriate steps to delete it.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">14. Changes</h2>
        <p className="mt-3">
          We may update this Privacy Policy from time to time. We will post the updated version on
          this page and update the “Last updated” date. If changes are material, we may provide
          additional notice as required by law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">15. Contact</h2>
        <p className="mt-3">
          Questions about this Privacy Policy:{' '}
          <a className="text-blue-600 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
