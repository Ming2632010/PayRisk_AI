# PayRisk AI – Final review: App Store, Google Play & launch readiness

Use this checklist to confirm store compliance and what to change before submitting to Apple App Store and Google Play (and before going to market).

---

## 1. Apple App Store

### Billing (subscription on website)

- **Your model:** Free app; upgrades to paid plans are done via Stripe on your website (user is redirected to Stripe Checkout from the app).
- **Apple rule:** Apps that offer **digital goods or subscriptions that unlock app features** must use **In‑App Purchase** for those purchases, **or** avoid directing users from inside the app to an external payment page. Many “reader”/“account” apps (Netflix, Spotify, etc.) are free to download and tell users to “manage subscription on our website” without an in‑app “Buy” link to the payment page.
- **Recommendation:** To reduce review risk **without** adding IAP:
  - **Option A (safest):** In the **Plan** screen, for **upgrades**, do **not** redirect in‑app to Stripe. Instead:
    - Show a short line: *“Plans and billing are managed on our website.”*
    - Provide a single button/link that **opens your website** (e.g. `https://yourdomain.com?page=plan`) in the **system browser** (e.g. `window.open(url, '_blank')` or equivalent in your wrapper). The user then upgrades on the web; the app only opens the site.
  - **Option B:** Keep the current flow (in‑app redirect to Stripe). This is used by some apps; if Apple flags it, they may ask you to add IAP or move to Option A.
- **Copy:** Add a clear, neutral line on the Plan page, e.g. *“Upgrades and billing are managed on our website.”* so reviewers see you’re not hiding the fact that payment is external.

**Implemented:** The app uses **Option A**. The Plan screen has a single button *“Open website to upgrade or manage billing”* that opens your website in the system browser (`window.open(..., '_blank')`). The website URL is set via **`VITE_APP_URL`** (e.g. `https://yourdomain.com`); if unset, it falls back to `window.location.origin`. Downgrades still happen in‑app (no payment).

### Required for all apps

| Item | Status | Notes |
|------|--------|--------|
| **Privacy Policy** | ❌ Add | Required when you collect data (email, password, customer data). Must be a **public URL** (e.g. `https://yourdomain.com/privacy`) and linked from the app (e.g. signup screen or Settings/About). |
| **Terms of Service (ToS)** | ❌ Add | Strongly recommended when you take payments or store user/customer data. Host at e.g. `https://yourdomain.com/terms` and link from app/signup. |
| **Sign-in / account** | ✅ | Email + password; no Apple/Google sign-in required by Apple for your model. |
| **Age rating** | ⚠️ Set | Business/finance apps are usually 4+ or 12+; set in App Store Connect based on content. |
| **App metadata** | ⚠️ Prepare | Title, subtitle, description, keywords, screenshots, app icon (no placeholder). |
| **Support URL** | ❌ Add | Apple requires a support URL (e.g. `https://yourdomain.com/support` or contact page). |
| **OG image / icon** | ⚠️ Replace | Replace `og:image` / `twitter:image` in `index.html` if they still point to `bolt.new`; use your own icon or branding. |

### Data and privacy

- You collect: **email, password (hashed), customer/transaction data**. Apple’s **App Privacy** section in App Store Connect will ask what data you collect and whether it’s used for tracking. Fill this accurately.
- If you use **Resend/Twilio** (email/SMS), say so in the Privacy Policy (e.g. “We use third‑party services to send emails and SMS on your behalf”).

---

## 2. Google Play

### Billing (subscription on website)

- **Your model:** Same as above – free app, paid plans on your website via Stripe.
- **Google rule:** For **in‑app** digital goods/subscriptions, Google generally expects use of **Google Play Billing**. Letting users **subscribe only on your website** (no in‑app purchase flow) is a common pattern; the app should not mislead users (e.g. “Subscribe” in the app that directly opens a payment page can be sensitive; “Manage billing on our website” is clearer).
- **Recommendation:** Same as Apple: either open your **website** for plan/billing (safest) or keep Stripe redirect but add clear copy that billing is on the web. Avoid in‑app copy that sounds like “Buy subscription in this app” if the purchase is on the web.

### Required for all apps

| Item | Status | Notes |
|------|--------|--------|
| **Privacy Policy** | ❌ Add | **Required** – must be a public URL and linked from the app and from the Play Console store listing. |
| **Terms / other policies** | ❌ Add | Recommended when you take payments; link from app and store listing if needed. |
| **Data safety form** | ❌ Fill | In Play Console, declare what data you collect (e.g. email, user‑generated content), whether it’s shared, and how it’s used. |
| **Target audience / content rating** | ⚠️ Set | Complete the questionnaire and set the appropriate rating. |
| **App metadata & assets** | ⚠️ Prepare | Short/long description, screenshots, icon, feature graphic. |

---

## 3. Changes to make before launch

### Must-have (store & legal)

1. **Privacy Policy**
   - Publish at a stable URL (e.g. `https://yourdomain.com/privacy`).
   - Cover: what you collect (account, customers, transactions), how you use it, Resend/Twilio/Stripe if used, retention, user rights, contact.
   - Link from: signup or first-run screen, and from a footer/About/Settings in the app.

2. **Terms of Service**
   - Publish at e.g. `https://yourdomain.com/terms`.
   - Cover: use of the service, payment (Stripe), limits, termination, disclaimer, governing law.
   - Link from app (e.g. signup or Plan/Support area).

3. **Support URL**
   - Have a dedicated page or email (e.g. `https://yourdomain.com/support` or `support@yourdomain.com`) and use it in App Store Connect and Play Console.

4. **Plan / billing copy (store-friendly)**
   - On the Plan page, add a short line: *“Plans and billing are managed on our website.”*
   - Optional but recommended for store compliance: for upgrades, open your website in the system browser instead of redirecting in‑app to Stripe (see Apple section above).

### Should-have (from PRE_LAUNCH_REVIEW)

5. **CORS** – In production, set `origin` to your frontend URL(s) (e.g. `https://yourdomain.com`), not `true`.
6. **Rate limiting** – Add rate limiting on `/auth/login` and `/auth/signup`.
7. **Health check** – Add `GET /health` (e.g. returns 200) for monitoring.
8. **Env** – Ensure production uses env vars for all secrets; no `.env` in repo.

### Good-to-have

9. **index.html** – Replace default `og:image` and `twitter:image` with your own icon or branding.
10. **Signup** – Optional: add “By signing up you agree to our Terms and Privacy Policy” with links.
11. **Password reset** – Currently shows “not configured”; either implement (e.g. Resend magic link) or replace message with “Contact support at …”.

---

## 4. Launch checklist (consolidated)

### Backend / env

- [ ] All Neon migrations run (`neon_migration_plans_usage.sql`, `neon_migration_invoice.sql`, `neon_migration_email_templates.sql`).
- [ ] Production env: `NEON_DATABASE_URL`, `AUTH_JWT_SECRET`, `RESEND_API_KEY`, `FROM_EMAIL` (if using email); Twilio vars (if using SMS); `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL`.
- [ ] CORS restricted to production frontend origin.
- [ ] Rate limiting on auth routes.
- [ ] `GET /health` implemented.

### Frontend / app

- [ ] `VITE_API_URL` (or equivalent) points to production API.
- [ ] Privacy Policy URL linked in app (and published).
- [ ] Terms of Service URL linked in app (and published).
- [ ] Support URL or contact available in app and in store listings.
- [ ] Plan page: “Plans and billing are managed on our website.” + single button that opens website in system browser (done).
- [ ] **`VITE_APP_URL`** set to your public website URL (e.g. `https://yourdomain.com`) so the Plan “Open website” button opens the correct domain (especially when the app is a native wrapper or PWA).
- [ ] Replace default OG/twitter images in `index.html` if still placeholder.

### Store submissions

- [ ] **Apple:** App Store Connect – metadata, screenshots, icon, Privacy Policy URL, Support URL, age rating, App Privacy form.
- [ ] **Google:** Play Console – store listing, Privacy Policy URL, Data safety form, content rating, support contact.

### Legal / ops

- [ ] Privacy Policy and ToS reviewed (by you or a lawyer) for your use of data and payments.
- [ ] No secrets in repo; production secrets in host env only.

---

## 5. Summary

- **Store acceptance:** Both Apple and Google allow a **free app** with **subscriptions managed on your website**, as long as you don’t mislead users and you meet policy (Privacy Policy, support, data declaration).
- **Billing in the app:** The app uses **Option A**: one button opens your **website** in the system browser for upgrades; no in‑app payment or redirect to Stripe. Downgrades are done in‑app (no payment).
- **Blockers before launch:** Add **Privacy Policy** and **Terms of Service** (with URLs and in‑app links), **Support URL**, and set **VITE_APP_URL** for the Plan button. Then complete store metadata, data safety/App Privacy, and the rest of the checklist above.

Once these are done, the app is in a good position for store submission and market launch.

---

## 6. App payment method (after modification)

| Where | What happens |
|-------|-------------------------------|
| **In the app (Plan screen)** | User sees current plan and usage. For **upgrades**: one button, *“Open website to upgrade or manage billing”*, opens your website in the **system browser** (`_blank`). No Stripe link and no payment inside the app. For **downgrades**: user taps a plan and the app calls the API (no payment). |
| **On your website** | User signs in (same account). Plan page shows upgrade options; choosing a paid plan creates a Stripe Checkout session and completes payment on the web. Plan is updated via webhook. |
| **Apple / Google** | No in‑app purchase and no in‑app link to a payment page; the app only opens the developer’s website. Complies with both stores’ expectation that purchases for digital goods/subscriptions either use IAP or happen outside the app (e.g. on your website). |
