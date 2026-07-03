import { Link } from 'react-router-dom';
import { LegalDocumentLayout } from '../components/LegalDocumentLayout';
import { LEGAL_CONTACT_EMAIL, SITE_NAME } from '../legal/config';

function Keyword({ children }: { children: string }) {
  return (
    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm font-medium text-gray-800">
      {children}
    </span>
  );
}

export function SmsTermsPage() {
  return (
    <LegalDocumentLayout title="SMS Terms & Messaging Policy">
      <section>
        <p>
          This page describes the SMS messaging program operated through {SITE_NAME} and how
          recipients consent to, and opt out of, those messages. It is provided for transparency and
          for carrier (A2P 10DLC) campaign review.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">1. Program description</h2>
        <p className="mt-3">
          {SITE_NAME} is a business software platform (SaaS) used by merchants to send payment- and
          account-related text messages to their own existing customers. Messages are initiated by
          the merchant from their {SITE_NAME} account and are limited to transactional,
          account-related content such as invoice and balance reminders, due-date notices, payment
          confirmations, and similar follow-ups tied to money the customer owes the merchant. These
          messages are not used for broad marketing or promotional campaigns.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">2. Types of messages you may receive</h2>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li>Upcoming or due payment and invoice reminders.</li>
          <li>Overdue balance notices.</li>
          <li>Payment received / receipt confirmations.</li>
          <li>Account-related follow-ups tied to your relationship with the merchant.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">3. How consent is obtained (opt-in)</h2>
        <p className="mt-3">
          {SITE_NAME} does <strong className="font-medium text-gray-900">not</strong> use a text-in
          keyword to a short or long code. Each merchant collects prior express consent directly from
          their customer in the normal course of business, through one or more of these channels:
        </p>
        <ul className="mt-3 list-disc pl-5 space-y-2">
          <li>
            On the merchant&apos;s own website or customer portal, where the customer provides a
            mobile number and agrees to receive account/payment text messages;
          </li>
          <li>
            On paper or digital intake forms, service contracts, or invoices that include a phone
            field and a notice that the number may be used for payment/account reminders by SMS;
          </li>
          <li>
            Verbally or in writing during account setup, where the customer provides their mobile
            number for account communications.
          </li>
        </ul>
        <p className="mt-3">
          At the point of consent, the customer is told: the business&apos;s name; that they will
          receive payment- and account-related text messages; that message frequency varies; that
          message and data rates may apply; that they can reply <Keyword>STOP</Keyword> to opt out
          and <Keyword>HELP</Keyword> for help; and where to find this policy, the Privacy Policy,
          and the Terms of Service.
        </p>
        <p className="mt-3">
          <span className="font-medium text-gray-900">Platform enforcement.</span> Before a merchant
          can send any SMS to a contact, {SITE_NAME} requires the merchant to check a consent
          confirmation box that states:{' '}
          <em>
            &ldquo;I confirm this contact has agreed to receive payment and account-related SMS from
            my business.&rdquo;
          </em>{' '}
          Merchants also agree in our Terms of Service to obtain and retain proof of consent and to
          message only recipients who have opted in. A{' '}
          <Link to="/sms-opt-in-sample" className="text-blue-600 hover:underline">
            public sample of end-user and platform opt-in flows
          </Link>{' '}
          is available for carrier (A2P 10DLC) review.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">4. Message frequency</h2>
        <p className="mt-3">
          Message frequency varies. It depends on how often a merchant sends reminders from their
          account and on the status of your balance; there is no fixed schedule from {SITE_NAME}.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">5. Cost</h2>
        <p className="mt-3">
          <span className="text-gray-800">Message and data rates may apply</span> based on your
          mobile carrier and plan. {SITE_NAME} and the merchant do not charge you for receiving these
          messages.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">6. Opt-out (STOP)</h2>
        <p className="mt-3">
          You can opt out at any time by replying <Keyword>STOP</Keyword> (or{' '}
          <Keyword>STOPALL</Keyword>, <Keyword>UNSUBSCRIBE</Keyword>, <Keyword>CANCEL</Keyword>,{' '}
          <Keyword>END</Keyword>, <Keyword>QUIT</Keyword>) to any message. After you opt out you will
          receive a confirmation and no further SMS from that number, unless you opt back in. You may
          also contact the merchant directly or email{' '}
          <a className="text-blue-600 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">7. Help (HELP)</h2>
        <p className="mt-3">
          For help, reply <Keyword>HELP</Keyword> to any message, contact the merchant that messaged
          you directly, or email{' '}
          <a className="text-blue-600 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">8. Privacy</h2>
        <p className="mt-3">
          We do not sell, rent, or share mobile phone numbers collected through the Service with third
          parties for their own marketing or promotional purposes. Mobile opt-in data and consent are
          not shared with any third parties for marketing. For full details, see our{' '}
          <Link to="/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link to="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">9. Contact</h2>
        <p className="mt-3">
          Questions about this SMS program:{' '}
          <a className="text-blue-600 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
