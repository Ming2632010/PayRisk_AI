# PayRisk AI – Pre-launch review

Summary of **bugs fixed**, **issues to be aware of**, and **suggestions** before going to market.

---

## Bugs fixed in this review

### 1. Dashboard “Send Reminder” / “Send Offer” did not send email

- **Issue:** On the Dashboard, clicking “Send Reminder” or “Send Offer” only showed an alert; no API was called and no email was sent.
- **Fix:** Dashboard now calls `api.customers.sendReminder(id)` and `api.customers.sendOffer(id)` like the Customers page. Buttons show “Sending…” and are disabled while the request runs.

### 2. Custom Rules suggested they affected scoring

- **Issue:** Custom Rules are stored only in `localStorage` and are **not** used by `scoring.ts`. Risk and repurchase scores are computed with fixed logic, so users could think their rules were applied when they were not.
- **Fix:** The Custom Rules info box now states that rules are saved in the browser and will be used in a future update; the app currently uses built-in scoring only. Save confirmation message updated to match.

---

## Fixes implemented (previously “things to be aware of”)

### 3. Email Templates – now used by the server

- **Fix:** Reminder and offer templates are stored per user in the DB (`users.reminder_template`, `users.offer_template`). Run **`neon_migration_email_templates.sql`** in the Neon SQL Editor. The Email Settings page now loads/saves via `GET/PUT /api/email-templates`. Send-reminder and send-offer use the user’s saved subject and body (with `{{customer_name}}`, `{{amount}}`, `{{due_date}}`, `{{your_name}}`, `{{offer_details}}`).

### 4. Plan change – Stripe payment for upgrades

- **Fix:** Upgrading to a paid plan (Basic/Professional/Business) goes through Stripe Checkout. Set **`STRIPE_SECRET_KEY`** and **`STRIPE_WEBHOOK_SECRET`** in the server env; set **`FRONTEND_URL`** for success/cancel redirects. Webhook: `POST /api/webhooks/stripe` (raw body) updates `users.plan` on `checkout.session.completed`. Downgrades and free plan still use the direct plan switch (no payment). If Stripe is not configured, upgrades fall back to direct DB update.

### 5. New users table columns (migrations)

- **Fix:** Migration files added in the project root. Run in the Neon SQL Editor (in order): **`neon_migration_plans_usage.sql`**, **`neon_migration_invoice.sql`**, **`neon_migration_email_templates.sql`**. These add `plan`, `period_start`, `emails_sent_current_period`, `sms_sent_current_period`, `invoice_template`, `updated_at` on `users`; `last_invoice_sent_at` on `customers`; `reminder_template`, `offer_template` on `users`.

---

## Suggestions before real market

### Security and robustness

- **CORS:** Server uses `cors({ origin: true })`, so any origin can call the API. For production, set `origin` to your frontend URL(s) (e.g. `https://yourapp.com`).
- **Rate limiting:** Add rate limiting on `/auth/login` and `/auth/signup` (e.g. `express-rate-limit`) to reduce brute-force and abuse.
- **JWT:** 7-day expiry is reasonable; consider refresh tokens or “remember me” if you need longer sessions.
- **Env:** Never commit `.env`. In production, set all secrets in the host’s environment (e.g. Vercel/Railway env vars).

### Data and types

- **Numeric fields:** API sometimes returns numeric columns as strings. In scoring or totals, coerce with `Number()` where it matters (e.g. `amount_owed`, `average_order_value`) to avoid string concatenation instead of addition.
- **Validation:** Add simple validation on the server for customer create/update (e.g. required name/email, max lengths, email format) and return 400 with clear messages.

### User experience

- **Loading and errors:** Replace some `alert()` success/error with in-app toasts or inline messages so the flow feels more polished.
- **Empty states:** Ensure every list (customers, transactions, due today) has a clear empty state and, where relevant, a short “what to do next”.
- **Invoice template:** If the user has never saved an invoice template, consider a one-line hint on first “Send invoice” (e.g. “Add your company details under Invoice in the menu”).

### Operations and launch

- **Health check:** Add a simple `GET /health` (e.g. returns 200 and optionally checks DB connectivity) for monitoring and load balancers.
- **Logging:** In production, log request IDs and errors to a logging service (or structured logs) instead of only `console.error`.
- **Backups:** Rely on Neon’s backups and, if needed, define a retention policy.
- **Terms and privacy:** Before taking payments or storing personal data, add Terms of Service and Privacy Policy and, if required, consent flows.

---

## Quick checklist before launch

- [ ] All Neon migrations run: `neon_migration_plans_usage.sql`, `neon_migration_invoice.sql`, `neon_migration_email_templates.sql` (and `neon_migration_transactions.sql` if you use transactions).
- [ ] Resend and Twilio env vars set in production if you use email/SMS.
- [ ] Stripe: set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `FRONTEND_URL` for paid plan upgrades.
- [ ] CORS restricted to your frontend origin in production.
- [ ] Rate limiting on auth routes.
- [ ] Frontend `VITE_API_URL` (or equivalent) points to the production API.
- [ ] No secrets in repo; production env vars set on the host.

**For App Store / Google Play and full launch readiness**, see **`STORE_AND_LAUNCH_REVIEW.md`** (Privacy Policy, Terms, support URL, billing copy, and store checklist).

---

This file can stay in the repo as a pre-launch reference; update it as you fix or implement items.
