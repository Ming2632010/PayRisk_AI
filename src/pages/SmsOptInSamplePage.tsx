import { Link } from 'react-router-dom';
import { LegalDocumentLayout } from '../components/LegalDocumentLayout';
import { LEGAL_CONTACT_EMAIL, SITE_NAME } from '../legal/config';

/**
 * Public sample opt-in flows for A2P 10DLC campaign review (Twilio / TCR).
 * Merchants collect consent from their customers; PayRisk enforces attestation in-app.
 */
export function SmsOptInSamplePage() {
  return (
    <LegalDocumentLayout title="SMS Opt-In — Sample Flows (A2P Review)">
      <section>
        <p>
          This page shows how end-users consent to SMS before a merchant sends payment reminders
          through {SITE_NAME}. It is provided for carrier (A2P 10DLC) campaign verification.{' '}
          {SITE_NAME} does not use a text-in keyword; consent is collected by each merchant from
          their own customers.
        </p>
        <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <strong className="font-semibold">For Twilio / TCR reviewers:</strong> use the static
          Call-to-Action page (no JavaScript required):{' '}
          <a
            href="https://payriskai.com/sms-opt-in.html"
            className="font-medium text-blue-700 underline"
          >
            https://payriskai.com/sms-opt-in.html
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">
          1. Sample end-user opt-in (merchant website or portal)
        </h2>
        <p className="mt-3">
          Merchants display language like the sample below on their own intake forms, customer
          portals, contracts, or invoices. The consent checkbox is{' '}
          <strong className="font-medium text-gray-900">unchecked by default</strong>. Providing a
          phone number without checking the box does not enroll the customer in SMS.
        </p>

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Sample form — Example Merchant LLC
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Mobile phone</label>
              <input
                type="tel"
                readOnly
                value="+1 (555) 123-4567"
                className="mt-1 w-full max-w-sm rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600"
                aria-readonly
              />
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
              <input
                type="checkbox"
                readOnly
                checked={false}
                className="mt-1 h-4 w-4 rounded border-gray-300"
                aria-label="Sample SMS consent checkbox (unchecked by default)"
              />
              <p className="text-sm text-gray-700 leading-snug">
                I agree to receive payment and account-related text messages from{' '}
                <strong className="font-medium">Example Merchant LLC</strong>. Message frequency
                varies. Message and data rates may apply. Reply STOP to opt out and HELP for help.{' '}
                <Link to="/privacy" className="text-blue-600 hover:underline">
                  Privacy Policy
                </Link>
                ,{' '}
                <Link to="/terms" className="text-blue-600 hover:underline">
                  Terms of Service
                </Link>
                , and{' '}
                <Link to="/sms-terms" className="text-blue-600 hover:underline">
                  SMS Terms
                </Link>
                .
              </p>
            </div>
            <button
              type="button"
              disabled
              className="rounded-lg bg-gray-300 px-4 py-2 text-sm font-medium text-gray-500 cursor-not-allowed"
            >
              Save (sample only)
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">
          2. Paper or PDF forms (offline opt-in)
        </h2>
        <p className="mt-3">
          Merchants may collect the same consent on paper or PDF intake forms, service agreements, or
          invoices that include a mobile phone field and consent language equivalent to the sample
          above (business name, message type, frequency varies, rates may apply, STOP/HELP, and links
          or references to privacy and terms).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">3. Verbal opt-in</h2>
        <p className="mt-3">
          During account setup, a merchant may obtain verbal consent when the customer provides a
          mobile number for account and payment communications. The merchant documents consent in
          their records before adding the contact in {SITE_NAME}.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">
          4. Platform enforcement ({SITE_NAME} merchant account)
        </h2>
        <p className="mt-3">
          Before any SMS is sent, the merchant must confirm consent in their {SITE_NAME} account
          when adding or updating a customer phone number. This attestation is{' '}
          <strong className="font-medium text-gray-900">separate from merchant signup</strong> and
          applies only to that customer contact. The checkbox is unchecked by default.
        </p>

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Merchant dashboard — Add / edit customer (consent attestation)
          </p>
          <div className="mt-4 max-w-lg">
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              readOnly
              value="+1 (555) 987-6543"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600"
            />
            <div className="mt-3 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3">
              <input
                type="checkbox"
                readOnly
                checked={false}
                className="mt-1 h-4 w-4 rounded border-gray-300"
                aria-label="Merchant SMS consent attestation (unchecked by default)"
              />
              <p className="text-sm text-gray-700 leading-snug">
                I confirm this contact has agreed to receive payment and account-related SMS from my
                business. Required when you add or change the phone number, and to use Send SMS. See{' '}
                <Link to="/terms" className="text-blue-600 hover:underline font-medium">
                  Terms of Service
                </Link>
                .
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            The live consent UI is available to authenticated merchants at{' '}
            <span className="font-mono text-gray-600">payriskai.com</span> → Customers → Add/Edit
            Customer. This public page documents the same language for carrier review.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">5. Required links</h2>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li>
            <Link to="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>{' '}
            — includes no sale/sharing of mobile numbers for third-party marketing, message
            frequency, and rates disclosure.
          </li>
          <li>
            <Link to="/terms" className="text-blue-600 hover:underline">
              Terms of Service
            </Link>
          </li>
          <li>
            <Link to="/sms-terms" className="text-blue-600 hover:underline">
              SMS Terms &amp; Messaging Policy
            </Link>
          </li>
        </ul>
        <p className="mt-3">
          Questions:{' '}
          <a className="text-blue-600 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
            {LEGAL_CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
