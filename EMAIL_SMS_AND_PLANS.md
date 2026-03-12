# Email, SMS & subscription plans

## Environment variables (server)

In `server/.env` (see `server/.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `NEON_DATABASE_URL` | Yes | Neon Postgres connection string |
| `AUTH_JWT_SECRET` | Yes | JWT signing secret |
| `PORT` | No | Default 3001 |
| **Email (Resend)** | | |
| `RESEND_API_KEY` | For email | From [Resend](https://resend.com) → API Keys |
| `FROM_EMAIL` | No | Sender address (default: `onboarding@resend.dev` for testing). Use your verified domain in production. |
| **SMS (Twilio)** | | |
| `TWILIO_ACCOUNT_SID` | For SMS | From [Twilio Console](https://console.twilio.com) |
| `TWILIO_AUTH_TOKEN` | For SMS | From Twilio Console |
| `TWILIO_PHONE_NUMBER` | For SMS | Your Twilio phone number (e.g. `+1234567890`) |

If email or SMS env vars are missing, the app still runs; "Send Reminder", "Send Offer", or "Send SMS" will return a friendly error asking you to configure the server.

## Database: plans & usage

Run **`neon_migration_plans_usage.sql`** in the Neon SQL Editor (once) so the `users` table has:

- `plan` (starter | basic | professional | business)
- `period_start`, `emails_sent_current_period`, `sms_sent_current_period`

New signups get `plan = 'starter'`. Usage resets at the start of each calendar month.

## Plan limits (Option A)

| Plan | Price | Emails/month | SMS/month |
|------|--------|---------------|-----------|
| Starter | $0 | 50 | 0 |
| Basic | $19 | 500 | 50 |
| Professional | $49 | 2,000 | 200 |
| Business | $99 | 6,000 | 600 |

Users can change plan from the **Plan** page (upgrade/downgrade). Billing is not integrated; plan is stored in the DB only. You can add Stripe (or similar) later.

## In-app behaviour

- **Due today**: Banner at the top when there are customers with `due_date = today` and amount owed > 0. Click through to Customers to send reminder or SMS.
- **Send Reminder**: Sends one email via Resend (payment reminder). Counts against email limit.
- **Send Offer**: Sends one email via Resend (special offer). Counts against email limit.
- **Send SMS**: Sends one SMS via Twilio (reminder-style message). Counts against SMS limit; only available on Basic and above.

## Other suggestions for PayRisk AI

- **Stripe (or other) billing**: Charge for Basic/Professional/Business and enforce plan in the app.
- **Daily email digest**: Send the app user an email (e.g. via Resend) listing “customers with payment due today” so they don’t have to open the app.
- **Web Push**: Browser push when there are due-today customers (requires service worker + VAPID and a cron/scheduler).
- **Audit log**: Store sent emails/SMS (customer, channel, time) for support and usage reports.
- **Templates**: Let the user edit reminder/offer email and SMS text in settings (e.g. Email Templates page).
