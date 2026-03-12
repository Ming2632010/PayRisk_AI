# PayRisk AI vs similar products – advantages and what to learn

## Your advantages (PayRisk AI)

### 1. **Risk + repurchase in one place**
- You combine **payment/credit risk** (who might pay late or default) with **repurchase intent** (who is likely to buy again). Many tools do only reminders or only risk.
- **Custom Rules** let users tune risk and repurchase scores (e.g. “if amount_owed > X, add to risk”) without a data team.
- **Dashboard** shows both risk distribution and repurchase value, so users can chase late payers and nurture high-value customers in the same app.

### 2. **Order-led, not invoice-led**
- Amount owed, due date, total orders, average order value, and last purchase are **derived from transactions**, not typed by hand. That keeps data consistent and reduces errors.
- Suits **product/service orders** and **recurring work** as well as one-off invoices.

### 3. **Simple, transparent pricing**
- **Starter free** (50 emails, no SMS) with clear upgrade path (Basic → Professional → Business). Easy to explain and compare to Remindax/Invoxera-style “credits.”
- Plan and usage (emails/SMS this period) are visible on the **Plan** page, with upgrade/downgrade reasons.

### 4. **Due-today nudge**
- In-app **“X customers with payment due today”** banner pushes the user to act (send reminder or SMS) without opening another tool. Many competitors assume you live in their inbox or aging report.

### 5. **Unified actions**
- From one customer row: **Send reminder (email), Send offer (email), Send SMS**, view transactions, notes, edit. No switching between “collections” and “CRM” products for small teams.

### 6. **Lightweight stack**
- Single backend (Node + Neon), Resend + Twilio for delivery. You can run and deploy without heavy ERP or accounting integrations, which helps small businesses and fast iteration.

---

## Where competitors are strong – what you can learn

### 1. **Accounting / invoice integration**
- **Them:** Sync with Xero, QuickBooks, etc.; pull invoices and payment status automatically; aging reports (30/60/90 days).
- **Learn:** Add at least one integration (e.g. QuickBooks or Xero) so “amount owed” and “due date” can come from real invoices, with transactions in PayRisk for orders if you want to keep that model. Optionally show “invoices” as a list per customer.

### 2. **Smart send timing and sequences**
- **Them:** Send reminders when the customer is most likely to respond; multi-step sequences (e.g. day 0, day 7, day 14) instead of one-off clicks.
- **Learn:** “Schedule reminder” (e.g. send in 3 days) and/or **reminder sequences** (e.g. 3 emails over 2 weeks) with simple rules (e.g. “if still unpaid after 7 days, send step 2”). Use your risk score to suggest “high risk → shorter sequence.”

### 3. **Predictive / AI layer**
- **Them:** “30-day delinquency forecast,” “probability of late payment,” ML-based prioritization.
- **Learn:** Keep your current rule-based risk score, but add one or two **predictive-style metrics**, e.g. “Likely to pay within 7 days” (based on due_date + risk + history) or “Suggested next contact date.” You can start with simple formulas and later replace with a small model if you have data.

### 4. **360° customer view**
- **Them:** One screen: all invoices, all emails/SMS sent, payment history, notes.
- **Learn:** A **customer detail page** (or expanded row) that shows: basic info, transactions list, notes, and a **log of sent reminders/offers/SMS** (you’d need to store sent messages and show them). Reduces “did I already email them?” and supports your due-today workflow.

### 5. **DSO and aging metrics**
- **Them:** Days Sales Outstanding, aging buckets (current, 1–30, 31–60, 61–90), trend charts.
- **Learn:** On the dashboard, add **aging summary** (e.g. “$X due in 0–30 days, $Y in 31–60”) and **DSO** (e.g. total outstanding / (revenue over period) × days). Uses the same transaction-derived data you already have.

### 6. **Templates and branding**
- **Them:** Editable email/SMS templates, company branding, “from” name.
- **Learn:** Let users edit **reminder** and **offer** (and optionally SMS) text in **Email Templates** (or a dedicated “Message templates” section), and use a configurable **from name** (e.g. “Acme Corp”) in addition to FROM_EMAIL. Makes PayRisk feel like “their” tool.

### 7. **Stripe (or other) billing**
- **Them:** Paid plans are charged automatically; upgrades/downgrades update subscription and limits.
- **Learn:** Integrate **Stripe** (or similar) for Basic/Professional/Business so plan changes are paid and usage limits are enforced by subscription tier. You already have plan and usage in the DB; this is the next step to monetize.

### 8. **Audit and compliance**
- **Them:** Log of who was contacted, when, and which channel; useful for disputes and compliance.
- **Learn:** **Store every sent email/SMS** (customer_id, channel, type e.g. reminder/offer, timestamp, optional outcome). Show in the 360 view and optionally in a simple “Activity” or “Sent log” report. Improves trust and supports “what did we do?” questions.

---

## Summary

| | PayRisk AI | Typical competitors |
|--|------------|----------------------|
| **Strength** | Risk + repurchase, custom rules, order-based data, simple plans, due-today nudge, one-place actions | Invoicing/accounting sync, sequences, AI prediction, 360 view, DSO/aging, billing |
| **Best for** | Small teams, product/order-based businesses, clear risk + growth view | Finance teams, invoice-heavy workflows, enterprises |

**Prioritized “learn from them” list:**  
(1) **Sent-message log + 360-style customer view**, (2) **Editable templates + from name**, (3) **Aging + DSO on dashboard**, (4) **Reminder sequences**, (5) **Stripe billing**, (6) **One accounting integration** when you’re ready.
