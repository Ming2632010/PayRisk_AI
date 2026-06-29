/**
 * Stripe recurring subscriptions, anniversary usage periods, and billing emails.
 */

export const PLAN_ORDER = ['starter', 'basic', 'professional', 'business'];
export const PLAN_LIMITS = {
  starter: { emails: 50, sms: 0 },
  basic: { emails: 500, sms: 50 },
  professional: { emails: 2000, sms: 200 },
  business: { emails: 6000, sms: 600 },
};
export const PLAN_PRICE_CENTS = { starter: 0, basic: 1900, professional: 4900, business: 9900 };
export const PLAN_LABELS = { starter: 'Starter', basic: 'Basic', professional: 'Professional', business: 'Business' };

const PAID_PLANS = ['basic', 'professional', 'business'];
const ACTIVE_SUB_STATUSES = new Set(['active', 'trialing']);
const INACTIVE_SUB_STATUSES = new Set(['canceled', 'unpaid', 'incomplete_expired', 'past_due', 'incomplete']);

function lookupKeyForPlan(plan) {
  return `payrisk_${plan}_monthly`;
}

function planFromLookupKey(lookupKey) {
  if (!lookupKey || typeof lookupKey !== 'string') return null;
  const m = lookupKey.match(/^payrisk_(basic|professional|business)_monthly$/);
  return m ? m[1] : null;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

/** Neon/Postgres DATE columns may arrive as Date objects — always normalize to YYYY-MM-DD. */
function normalizeDbDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return isoDate(value);
  }
  const s = String(value).trim();
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return isoDate(d);
}

function addMonthsDate(dateStr, months = 1) {
  const normalized = normalizeDbDate(dateStr) || isoDate(new Date());
  const d = new Date(`${normalized}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate(new Date());
  d.setUTCMonth(d.getUTCMonth() + months);
  return isoDate(d);
}

function unixToIsoDate(unixSeconds) {
  if (!unixSeconds) return null;
  return isoDate(new Date(unixSeconds * 1000));
}

/** Stripe Basil (2025-03-31+) moved period fields from Subscription to SubscriptionItem. */
function subscriptionPeriodBounds(sub) {
  const item = sub?.items?.data?.[0];
  return {
    start: sub?.current_period_start ?? item?.current_period_start ?? null,
    end: sub?.current_period_end ?? item?.current_period_end ?? null,
  };
}

function invoicePeriodBounds(inv) {
  const line = inv?.lines?.data?.[0];
  return {
    start: inv?.period_start ?? line?.period?.start ?? null,
    end: inv?.period_end ?? line?.period?.end ?? null,
  };
}

function invoiceMatchesBillingPeriod(inv, periodStart, periodEnd) {
  const { start, end } = invoicePeriodBounds(inv);
  const invStart = normalizeDbDate(unixToIsoDate(start));
  const invEnd = normalizeDbDate(unixToIsoDate(end));
  if (periodStart && invStart === periodStart) return true;
  if (periodEnd && invEnd === periodEnd) return true;
  return false;
}

function invoicePaidDate(inv) {
  const paidAt = inv?.status_transitions?.paid_at ?? inv?.created ?? null;
  return normalizeDbDate(unixToIsoDate(paidAt));
}

/** Stripe Basil (2025-03-31+) removed top-level invoice.subscription — use parent.subscription_details. */
function invoiceSubscriptionId(inv) {
  const legacy = inv?.subscription;
  if (legacy) return typeof legacy === 'string' ? legacy : legacy?.id ?? null;
  const parent = inv?.parent;
  if (parent?.type === 'subscription_details') {
    const sub = parent.subscription_details?.subscription;
    return typeof sub === 'string' ? sub : sub?.id ?? null;
  }
  return null;
}

function formatUsd(cents) {
  return `$${(cents / 100).toFixed(2)} USD`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export function createStripeBilling({ sql, stripe, resendApi, fromEmail, formatResendFrom, frontendUrl }) {
  const priceCache = new Map();

  async function getOrCreatePriceId(plan) {
    if (!stripe) throw new Error('Stripe is not configured');
    if (!PAID_PLANS.includes(plan)) throw new Error('Invalid paid plan');
    if (priceCache.has(plan)) return priceCache.get(plan);

    const lookupKey = lookupKeyForPlan(plan);
    const listed = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    if (listed.data.length > 0) {
      priceCache.set(plan, listed.data[0].id);
      return listed.data[0].id;
    }

    const created = await stripe.prices.create({
      lookup_key: lookupKey,
      currency: 'usd',
      unit_amount: PLAN_PRICE_CENTS[plan],
      recurring: { interval: 'month' },
      product_data: { name: `PayRisk AI – ${PLAN_LABELS[plan]}` },
    });
    priceCache.set(plan, created.id);
    return created.id;
  }

  async function resolvePlanFromSubscription(sub) {
    const metaPlan = sub.metadata?.plan;
    if (metaPlan && PAID_PLANS.includes(metaPlan)) return metaPlan;
    const item = sub.items?.data?.[0];
    const lookupKey = item?.price?.lookup_key;
    const fromKey = planFromLookupKey(lookupKey);
    if (fromKey) return fromKey;
    const priceId = item?.price?.id;
    if (priceId) {
      for (const p of PAID_PLANS) {
        try {
          const id = await getOrCreatePriceId(p);
          if (id === priceId) return p;
        } catch (_) { /* ignore */ }
      }
    }
    return null;
  }

  async function getUserBillingRow(userId) {
    try {
      const rows = await sql`
        SELECT id, email, plan, period_start, period_end, usage_period_start,
               usage_reset_for_invoice_id,
               emails_sent_current_period, sms_sent_current_period,
               stripe_customer_id, stripe_subscription_id, subscription_status,
               subscription_renewal_reminder_sent_at, updated_at
        FROM users WHERE id = ${userId}
      `;
      return rows[0] ?? null;
    } catch (e) {
      if (!e.message || !/column/.test(e.message)) throw e;
      try {
        const rows = await sql`
          SELECT id, email, plan, period_start, period_end,
                 emails_sent_current_period, sms_sent_current_period,
                 stripe_customer_id, stripe_subscription_id, subscription_status,
                 subscription_renewal_reminder_sent_at, updated_at
          FROM users WHERE id = ${userId}
        `;
        const r = rows[0];
        if (!r) return null;
        return { ...r, usage_period_start: null, usage_reset_for_invoice_id: null };
      } catch (e2) {
        if (!e2.message || !/stripe_|subscription_|period_end|column/.test(e2.message)) throw e2;
        const rows = await sql`
          SELECT id, email, plan, period_start,
                 emails_sent_current_period, sms_sent_current_period
          FROM users WHERE id = ${userId}
        `;
        const r = rows[0];
        if (!r) return null;
        return {
          ...r,
          period_end: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          subscription_status: 'none',
          subscription_renewal_reminder_sent_at: null,
          usage_period_start: null,
          usage_reset_for_invoice_id: null,
          updated_at: null,
        };
      }
    }
  }

  async function resetUsagePeriod(userId, periodStart, periodEnd, extra = {}) {
    const { plan, subscriptionStatus, stripeCustomerId, stripeSubscriptionId, stripeInvoiceId } =
      extra;
    try {
      if (plan !== undefined) {
        if (stripeInvoiceId) {
          await sql`
            UPDATE users SET
              plan = ${plan},
              period_start = ${periodStart},
              period_end = ${periodEnd},
              emails_sent_current_period = 0,
              sms_sent_current_period = 0,
              subscription_status = ${subscriptionStatus ?? 'active'},
              stripe_customer_id = COALESCE(${stripeCustomerId ?? null}, stripe_customer_id),
              stripe_subscription_id = COALESCE(${stripeSubscriptionId ?? null}, stripe_subscription_id),
              subscription_renewal_reminder_sent_at = NULL,
              usage_period_start = ${periodStart},
              usage_reset_for_invoice_id = ${stripeInvoiceId},
              updated_at = now()
            WHERE id = ${userId}
          `;
        } else {
          await sql`
            UPDATE users SET
              plan = ${plan},
              period_start = ${periodStart},
              period_end = ${periodEnd},
              emails_sent_current_period = 0,
              sms_sent_current_period = 0,
              subscription_status = ${subscriptionStatus ?? 'active'},
              stripe_customer_id = COALESCE(${stripeCustomerId ?? null}, stripe_customer_id),
              stripe_subscription_id = COALESCE(${stripeSubscriptionId ?? null}, stripe_subscription_id),
              subscription_renewal_reminder_sent_at = NULL,
              usage_period_start = ${periodStart},
              updated_at = now()
            WHERE id = ${userId}
          `;
        }
      } else if (stripeInvoiceId) {
        await sql`
          UPDATE users SET
            period_start = ${periodStart},
            period_end = ${periodEnd},
            emails_sent_current_period = 0,
            sms_sent_current_period = 0,
            subscription_renewal_reminder_sent_at = NULL,
            usage_period_start = ${periodStart},
            usage_reset_for_invoice_id = ${stripeInvoiceId},
            updated_at = now()
          WHERE id = ${userId}
        `;
      } else {
        await sql`
          UPDATE users SET
            period_start = ${periodStart},
            period_end = ${periodEnd},
            emails_sent_current_period = 0,
            sms_sent_current_period = 0,
            subscription_renewal_reminder_sent_at = NULL,
            usage_period_start = ${periodStart},
            updated_at = now()
          WHERE id = ${userId}
        `;
      }
    } catch (e) {
      if (!e.message || !/stripe_|subscription_|period_end|usage_reset_for_invoice_id|column/.test(e.message)) throw e;
      await sql`
        UPDATE users SET
          plan = COALESCE(${plan ?? null}, plan),
          period_start = ${periodStart},
          emails_sent_current_period = 0,
          sms_sent_current_period = 0,
          usage_period_start = ${periodStart},
          updated_at = now()
        WHERE id = ${userId}
      `;
    }
  }

  async function listPaidInvoicesForUser(row) {
    if (!stripe) return [];
    const listOpts = { status: 'paid', limit: 24 };
    let invoices = [];
    try {
      if (row.stripe_subscription_id) {
        const bySub = await stripe.invoices.list({
          ...listOpts,
          subscription: row.stripe_subscription_id,
        });
        invoices = bySub.data;
      }
      if (!invoices.length && row.stripe_customer_id) {
        const byCustomer = await stripe.invoices.list({
          ...listOpts,
          customer: row.stripe_customer_id,
        });
        invoices = byCustomer.data;
      }
    } catch (e) {
      console.error('Stripe invoice list for usage reconcile failed:', e.message);
    }
    return invoices;
  }

  /** Reset usage when a paid invoice for this period has not yet reset counters. */
  async function reconcileBillingUsagePeriod(userId, row) {
    const plan = row.plan || 'starter';
    if (!PAID_PLANS.includes(plan) || !row.stripe_subscription_id || !stripe) return;

    let sub;
    try {
      sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
    } catch (e) {
      console.error('Stripe subscription retrieve for usage reconcile failed:', e.message);
      return;
    }
    if (!ACTIVE_SUB_STATUSES.has(sub.status)) return;

    const resolvedPlan = (await resolvePlanFromSubscription(sub)) || plan;
    const { start, end } = subscriptionPeriodBounds(sub);
    const stripePeriodStart =
      normalizeDbDate(unixToIsoDate(start)) || normalizeDbDate(row.period_start);
    const stripePeriodEnd =
      normalizeDbDate(unixToIsoDate(end)) || normalizeDbDate(row.period_end);
    if (!stripePeriodStart) return;

    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    const resetExtra = {
      plan: resolvedPlan,
      subscriptionStatus: sub.status,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId ?? row.stripe_customer_id,
    };

    const hasUsage =
      Number(row.emails_sent_current_period ?? 0) > 0 ||
      Number(row.sms_sent_current_period ?? 0) > 0;
    const storedInvoiceId = row.usage_reset_for_invoice_id ?? null;
    const usagePeriodStart = normalizeDbDate(row.usage_period_start);
    const dbPeriodStart = normalizeDbDate(row.period_start);

    const invoices = await listPaidInvoicesForUser(row);
    const latestPeriodInvoice =
      invoices
        .filter((inv) => inv.amount_paid > 0 && invoicePaidDate(inv) >= stripePeriodStart)
        .sort((a, b) => b.created - a.created)[0] ?? null;

    if (latestPeriodInvoice) {
      const needsReset =
        latestPeriodInvoice.id !== storedInvoiceId ||
        (latestPeriodInvoice.id === storedInvoiceId && hasUsage);
      if (needsReset) {
        await resetUsagePeriod(userId, stripePeriodStart, stripePeriodEnd, {
          ...resetExtra,
          stripeInvoiceId: latestPeriodInvoice.id,
        });
        return;
      }
    }

    if (
      (usagePeriodStart && usagePeriodStart !== stripePeriodStart) ||
      (dbPeriodStart && dbPeriodStart !== stripePeriodStart)
    ) {
      await resetUsagePeriod(userId, stripePeriodStart, stripePeriodEnd, resetExtra);
      return;
    }

    if (usagePeriodStart == null) {
      try {
        await sql`
          UPDATE users SET usage_period_start = ${stripePeriodStart}, updated_at = now()
          WHERE id = ${userId}
        `;
      } catch (e) {
        if (!e.message || !/usage_period_start|column/.test(e.message)) throw e;
      }
    }
  }

  async function syncUserFromSubscription(userId, sub, { resetUsage = false, stripeInvoiceId = null } = {}) {
    const plan = await resolvePlanFromSubscription(sub);
    if (!plan) {
      console.error('Stripe sync: could not resolve plan for subscription', sub.id);
      return;
    }
    const { start, end } = subscriptionPeriodBounds(sub);
    const periodStart = unixToIsoDate(start);
    const periodEnd = unixToIsoDate(end);
    const status = sub.status || 'none';
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;

    const row = await getUserBillingRow(userId);
    const storedStart = normalizeDbDate(row?.period_start);
    const periodChanged = Boolean(periodStart && storedStart && periodStart !== storedStart);
    const shouldResetUsage = resetUsage || periodChanged;

    if (shouldResetUsage) {
      await resetUsagePeriod(userId, periodStart, periodEnd, {
        plan,
        subscriptionStatus: status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripeInvoiceId,
      });
      return;
    }

    try {
      await sql`
        UPDATE users SET
          plan = ${plan},
          period_start = ${periodStart},
          period_end = ${periodEnd},
          subscription_status = ${status},
          stripe_customer_id = COALESCE(${customerId ?? null}, stripe_customer_id),
          stripe_subscription_id = ${sub.id},
          updated_at = now()
        WHERE id = ${userId}
      `;
    } catch (e) {
      if (!e.message || !/stripe_|subscription_|period_end|column/.test(e.message)) throw e;
      await sql`UPDATE users SET plan = ${plan}, period_start = ${periodStart}, updated_at = now() WHERE id = ${userId}`;
    }
  }

  async function downgradeToStarter(userId) {
    const today = isoDate(new Date());
    const periodEnd = addMonthsDate(today, 1);
    try {
      await sql`
        UPDATE users SET
          plan = 'starter',
          stripe_subscription_id = NULL,
          subscription_status = 'none',
          period_start = ${today},
          period_end = ${periodEnd},
          emails_sent_current_period = 0,
          sms_sent_current_period = 0,
          subscription_renewal_reminder_sent_at = NULL,
          updated_at = now()
        WHERE id = ${userId}
      `;
    } catch (e) {
      if (!e.message || !/stripe_|subscription_|period_end|column/.test(e.message)) throw e;
      await sql`
        UPDATE users SET plan = 'starter', period_start = ${today}, emails_sent_current_period = 0,
          sms_sent_current_period = 0, updated_at = now()
        WHERE id = ${userId}
      `;
    }
  }

  async function resolveLegacyPeriodEnd(row) {
    let periodEnd = normalizeDbDate(row.period_end);
    const periodStart = normalizeDbDate(row.period_start);
    if (periodEnd) return periodEnd;
    if (!PAID_PLANS.includes(row.plan || 'starter') || row.stripe_subscription_id) return null;
    const anchor = periodStart || normalizeDbDate(row.updated_at);
    if (!anchor) return null;
    periodEnd = addMonthsDate(anchor, 1);
    try {
      await sql`UPDATE users SET period_end = ${periodEnd}, updated_at = now() WHERE id = ${row.id}`;
    } catch (_) { /* optional column */ }
    return periodEnd;
  }

  /** Sync Stripe subscription state; downgrade to Starter when unpaid or billing period ended. */
  async function syncAndExpireSubscription(userId, row) {
    const plan = row.plan || 'starter';
    if (!PAID_PLANS.includes(plan)) return false;

    const today = isoDate(new Date());

    if (stripe && row.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
        if (INACTIVE_SUB_STATUSES.has(sub.status)) {
          await downgradeToStarter(userId);
          return true;
        }
        if (ACTIVE_SUB_STATUSES.has(sub.status)) {
          const periodEnd = unixToIsoDate(subscriptionPeriodBounds(sub).end);
          if (periodEnd && today > periodEnd) {
            await downgradeToStarter(userId);
            return true;
          }
          await syncUserFromSubscription(userId, sub, { resetUsage: false });
          return false;
        }
      } catch (e) {
        if (e?.statusCode === 404 || e?.code === 'resource_missing') {
          await downgradeToStarter(userId);
          return true;
        }
      }
    }

    if (stripe && row.stripe_customer_id && !row.stripe_subscription_id) {
      try {
        const listed = await stripe.subscriptions.list({
          customer: row.stripe_customer_id,
          status: 'all',
          limit: 20,
        });
        const active = listed.data.find((s) => ACTIVE_SUB_STATUSES.has(s.status));
        if (active) {
          await syncUserFromSubscription(userId, active, { resetUsage: false });
          return false;
        }
      } catch (e) {
        console.error('Stripe subscription list failed:', e.message);
      }
    }

    const periodEnd = await resolveLegacyPeriodEnd(row);
    if (periodEnd && today > periodEnd) {
      await downgradeToStarter(userId);
      return true;
    }

    return false;
  }

  async function rollStarterPeriodIfNeeded(userId, row) {
    const today = isoDate(new Date());
    let start = normalizeDbDate(row.period_start) || today;
    let end = normalizeDbDate(row.period_end) || addMonthsDate(start, 1);

    if (today < end) return;

    while (today >= end) {
      start = end;
      end = addMonthsDate(start, 1);
    }

    try {
      await sql`
        UPDATE users SET
          period_start = ${start},
          period_end = ${end},
          emails_sent_current_period = 0,
          sms_sent_current_period = 0,
          updated_at = now()
        WHERE id = ${userId}
      `;
    } catch (e) {
      if (!e.message || !/period_end|column/.test(e.message)) throw e;
      await sql`
        UPDATE users SET period_start = ${start}, emails_sent_current_period = 0,
          sms_sent_current_period = 0, updated_at = now()
        WHERE id = ${userId}
      `;
    }
  }

  async function refreshBillingState(userId) {
    let row = await getUserBillingRow(userId);
    if (!row) return null;

    await syncAndExpireSubscription(userId, row);
    row = await getUserBillingRow(userId);
    if (!row) return null;

    if (PAID_PLANS.includes(row.plan || 'starter')) {
      await reconcileBillingUsagePeriod(userId, row);
      row = await getUserBillingRow(userId);
      if (!row) return null;
    }

    if (row && (row.plan || 'starter') === 'starter') {
      await rollStarterPeriodIfNeeded(userId, row);
      row = await getUserBillingRow(userId);
    }

    return row;
  }

  async function ensurePeriod(userId) {
    await refreshBillingState(userId);
  }

  async function getSubscription(userId) {
    const row = await refreshBillingState(userId);
    if (!row) return null;

    const plan = row.plan || 'starter';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
    const status = row.subscription_status || 'none';
    const periodEnd = normalizeDbDate(row.period_end);
    const periodStart = normalizeDbDate(row.period_start);

    const stripeActive =
      Boolean(row.stripe_subscription_id) &&
      ACTIVE_SUB_STATUSES.has(status) &&
      PAID_PLANS.includes(plan);

    let cancelAtPeriodEnd = false;
    if (stripe && row.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
        cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
      } catch (_) { /* ignore */ }
    }

    return {
      plan,
      period_start: periodStart,
      period_end: periodEnd,
      emails_sent: Number(row.emails_sent_current_period ?? 0),
      sms_sent: Number(row.sms_sent_current_period ?? 0),
      emails_limit: limits.emails,
      sms_limit: limits.sms,
      subscription_status: status,
      has_active_subscription: stripeActive,
      cancel_at_period_end: cancelAtPeriodEnd,
      next_billing_date: stripeActive ? periodEnd : null,
    };
  }

  async function canSendEmail(userId) {
    const sub = await getSubscription(userId);
    if (!sub) return { ok: false, error: 'User not found', code: 'USER_NOT_FOUND' };

    if (sub.emails_sent >= sub.emails_limit) {
      return {
        ok: false,
        error: 'Email limit reached for this billing period. Upgrade your plan on the Plan page.',
        code: 'EMAIL_LIMIT_REACHED',
      };
    }
    return { ok: true };
  }

  async function canSendSms(userId) {
    const sub = await getSubscription(userId);
    if (!sub) return { ok: false, error: 'User not found', code: 'USER_NOT_FOUND' };

    if (sub.sms_limit === 0) {
      return {
        ok: false,
        error: 'SMS is not included on your plan. Upgrade to Basic or higher on the Plan page.',
        code: 'SMS_NOT_INCLUDED',
      };
    }
    if (sub.sms_sent >= sub.sms_limit) {
      return {
        ok: false,
        error: 'SMS limit reached for this billing period. Upgrade your plan on the Plan page.',
        code: 'SMS_LIMIT_REACHED',
      };
    }
    return { ok: true };
  }

  async function incrementEmail(userId) {
    await sql`
      UPDATE users SET emails_sent_current_period = COALESCE(emails_sent_current_period, 0) + 1
      WHERE id = ${userId}
    `;
  }

  async function incrementSms(userId) {
    await sql`
      UPDATE users SET sms_sent_current_period = COALESCE(sms_sent_current_period, 0) + 1
      WHERE id = ${userId}
    `;
  }

  async function findUserIdByStripeRefs({ customerId, subscriptionId }) {
    if (subscriptionId) {
      try {
        const rows = await sql`SELECT id FROM users WHERE stripe_subscription_id = ${subscriptionId} LIMIT 1`;
        if (rows.length) return rows[0].id;
      } catch (_) { /* column may not exist */ }
    }
    if (customerId) {
      try {
        const rows = await sql`SELECT id FROM users WHERE stripe_customer_id = ${customerId} LIMIT 1`;
        if (rows.length) return rows[0].id;
      } catch (_) { /* column may not exist */ }
    }
    return null;
  }

  async function sendRenewalReminderEmail(user, invoice) {
    if (!resendApi) {
      console.warn('Renewal reminder skipped: Resend not configured');
      return;
    }
    const periodEnd = unixToIsoDate(invoice.period_end) || normalizeDbDate(user.period_end);
    const amount = formatUsd(invoice.amount_due ?? 0);
    const plan = user.plan || 'basic';
    const planLabel = PLAN_LABELS[plan] || plan;
    const billingUrl = `${String(frontendUrl).replace(/\/$/, '')}?page=plan`;

    const { error } = await resendApi.emails.send({
      from: formatResendFrom('PayRisk AI', fromEmail),
      to: user.email,
      subject: `Upcoming PayRisk AI subscription charge (${planLabel})`,
      html: `<p>Hello,</p>
<p>This is a friendly reminder that your <strong>PayRisk AI ${planLabel}</strong> subscription will renew soon.</p>
<ul>
  <li><strong>Renewal date:</strong> ${formatDisplayDate(periodEnd)}</li>
  <li><strong>Amount:</strong> ${amount}</li>
</ul>
<p>Your saved payment method on file will be charged automatically. Email and SMS usage counters reset when the new billing period starts.</p>
<p><a href="${billingUrl}">Manage your plan and billing</a></p>
<p>If you need to change plans or update your card, use the Plan page before the renewal date.</p>
<p style="color:#666;font-size:12px">You received this email because you have an active PayRisk AI subscription.</p>`,
    });
    if (error) console.error('Renewal reminder email failed:', error);
  }

  async function handleStripeWebhookEvent(event) {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode !== 'subscription') return;
      const userId = session.metadata?.userId;
      const subId = session.subscription;
      const customerId = session.customer;
      if (!userId || !subId || !stripe) return;

      try {
        await sql`
          UPDATE users SET
            stripe_customer_id = ${typeof customerId === 'string' ? customerId : customerId?.id ?? null},
            stripe_subscription_id = ${typeof subId === 'string' ? subId : subId?.id ?? null},
            updated_at = now()
          WHERE id = ${userId}
        `;
      } catch (e) {
        if (!e.message || !/stripe_|column/.test(e.message)) throw e;
      }

      const sub = await stripe.subscriptions.retrieve(
        typeof subId === 'string' ? subId : subId.id,
        { expand: ['latest_invoice'] },
      );
      const latestInvoice = sub.latest_invoice;
      const invoiceId =
        typeof latestInvoice === 'string' ? latestInvoice : latestInvoice?.id ?? null;
      await syncUserFromSubscription(userId, sub, { resetUsage: true, stripeInvoiceId: invoiceId });
      return;
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      if (!stripe) return;

      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) {
        console.warn('invoice.paid: no subscription on invoice', invoice.id);
        return;
      }

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      let userId = sub.metadata?.userId;
      if (!userId) {
        userId = await findUserIdByStripeRefs({
          customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          subscriptionId: sub.id,
        });
      }
      if (!userId) {
        console.error('invoice.paid: no user for subscription', sub.id);
        return;
      }

      const { start, end } = subscriptionPeriodBounds(sub);
      const periodStart = normalizeDbDate(unixToIsoDate(start));
      const periodEnd = normalizeDbDate(unixToIsoDate(end));
      const plan = await resolvePlanFromSubscription(sub);
      if (!plan || !periodStart) return;

      await resetUsagePeriod(userId, periodStart, periodEnd, {
        plan,
        subscriptionStatus: sub.status,
        stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
        stripeSubscriptionId: sub.id,
        stripeInvoiceId: invoice.id,
      });
      return;
    }

    if (event.type === 'invoice.upcoming') {
      const invoice = event.data.object;
      if (!stripe) return;

      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) return;

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      let userId = sub.metadata?.userId;
      if (!userId) {
        userId = await findUserIdByStripeRefs({
          customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          subscriptionId: sub.id,
        });
      }
      if (!userId) return;

      const row = await getUserBillingRow(userId);
      if (!row?.email) return;

      const periodEnd = unixToIsoDate(invoice.period_end);
      const alreadySent =
        row.subscription_renewal_reminder_sent_at &&
        String(row.subscription_renewal_reminder_sent_at).slice(0, 10) === periodEnd;
      if (alreadySent) return;

      await sendRenewalReminderEmail(row, invoice);

      try {
        await sql`
          UPDATE users SET subscription_renewal_reminder_sent_at = now(), updated_at = now()
          WHERE id = ${userId}
        `;
      } catch (_) { /* optional column */ }
      return;
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      let userId = sub.metadata?.userId;
      if (!userId) {
        userId = await findUserIdByStripeRefs({
          customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          subscriptionId: sub.id,
        });
      }
      if (!userId) return;

      if (['canceled', 'unpaid', 'incomplete_expired', 'past_due'].includes(sub.status)) {
        await downgradeToStarter(userId);
        return;
      }

      await syncUserFromSubscription(userId, sub, { resetUsage: false });
      return;
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      let userId = sub.metadata?.userId;
      if (!userId) {
        userId = await findUserIdByStripeRefs({
          customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          subscriptionId: sub.id,
        });
      }
      if (userId) await downgradeToStarter(userId);
    }
  }

  async function createCheckoutSession(userId, userEmail, plan) {
    if (!stripe) throw new Error('Billing is not configured. Set STRIPE_SECRET_KEY in server environment.');
    if (!PAID_PLANS.includes(plan)) throw new Error('Invalid plan.');

    const row = await getUserBillingRow(userId);
    if (!row) throw new Error('Not found');

    const currentIndex = PLAN_ORDER.indexOf(row.plan || 'starter');
    const targetIndex = PLAN_ORDER.indexOf(plan);
    const resubscribeSamePlan =
      targetIndex === currentIndex &&
      PAID_PLANS.includes(plan) &&
      !row.stripe_subscription_id;
    if (targetIndex < currentIndex) {
      throw new Error('Use plan change for downgrades or the same plan.');
    }
    if (targetIndex <= currentIndex && !resubscribeSamePlan) {
      throw new Error('Use plan change for downgrades or the same plan.');
    }

    if (
      row.stripe_subscription_id &&
      ACTIVE_SUB_STATUSES.has(String(row.subscription_status || ''))
    ) {
      await changeSubscriptionPlan(userId, row, plan);
      return { updated: true, url: null };
    }

    const priceId = await getOrCreatePriceId(plan);
    const sessionParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { userId, plan },
      },
      metadata: { userId, plan },
      success_url: `${frontendUrl}?page=plan&success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}?page=plan&cancel=1`,
    };

    if (row.stripe_customer_id) {
      sessionParams.customer = row.stripe_customer_id;
    } else {
      sessionParams.customer_email = userEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return { updated: false, url: session.url };
  }

  async function changeSubscriptionPlan(userId, row, plan) {
    if (!stripe) throw new Error('Stripe is not configured');
    if (!row.stripe_subscription_id) throw new Error('No active subscription to change.');
    const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
    const itemId = sub.items?.data?.[0]?.id;
    if (!itemId) throw new Error('Subscription has no billable item.');
    const priceId = await getOrCreatePriceId(plan);

    const updated = await stripe.subscriptions.update(row.stripe_subscription_id, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: 'create_prorations',
      metadata: { ...sub.metadata, userId, plan },
    });

    await syncUserFromSubscription(userId, updated, { resetUsage: false });
  }

  async function confirmCheckout(userId, sessionId) {
    if (!stripe) throw new Error('Billing is not configured. Set STRIPE_SECRET_KEY in server environment.');
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.mode !== 'subscription') {
      throw new Error('Invalid checkout session type.');
    }
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      throw new Error('Payment is not complete yet. Wait a few seconds and refresh the Plan page.');
    }
    const metaUserId = session.metadata?.userId;
    if (!metaUserId || metaUserId !== userId) {
      throw new Error('This payment belongs to a different account. Sign in with the same email you used for checkout.');
    }
    const subId = session.subscription;
    if (!subId) throw new Error('Checkout session has no subscription.');

    const customerId = session.customer;
    try {
      await sql`
        UPDATE users SET
          stripe_customer_id = ${typeof customerId === 'string' ? customerId : customerId?.id ?? null},
          stripe_subscription_id = ${typeof subId === 'string' ? subId : subId?.id ?? null},
          updated_at = now()
        WHERE id = ${userId}
      `;
    } catch (e) {
      if (!e.message || !/stripe_|column/.test(e.message)) throw e;
    }

    const sub = await stripe.subscriptions.retrieve(
      typeof subId === 'string' ? subId : subId.id,
      { expand: ['latest_invoice'] },
    );
    const latestInvoice = sub.latest_invoice;
    const invoiceId =
      typeof latestInvoice === 'string' ? latestInvoice : latestInvoice?.id ?? null;
    await syncUserFromSubscription(userId, sub, { resetUsage: true, stripeInvoiceId: invoiceId });
    return getSubscription(userId);
  }

  async function updatePlan(userId, plan) {
    if (!PLAN_ORDER.includes(plan)) throw new Error('Invalid plan.');

    const row = await getUserBillingRow(userId);
    if (!row) throw new Error('Not found');

    const currentPlan = row.plan || 'starter';
    const currentIndex = PLAN_ORDER.indexOf(currentPlan);
    const targetIndex = PLAN_ORDER.indexOf(plan);

    if (plan === 'starter') {
      if (row.stripe_subscription_id && stripe) {
        try {
          await stripe.subscriptions.cancel(row.stripe_subscription_id);
        } catch (e) {
          console.error('Stripe cancel failed:', e.message);
        }
      }
      await downgradeToStarter(userId);
      return getSubscription(userId);
    }

    if (
      row.stripe_subscription_id &&
      ACTIVE_SUB_STATUSES.has(String(row.subscription_status || '')) &&
      targetIndex !== currentIndex
    ) {
      if (targetIndex > currentIndex) {
        await changeSubscriptionPlan(userId, row, plan);
      } else {
        await changeSubscriptionPlan(userId, row, plan);
      }
      return getSubscription(userId);
    }

    if (targetIndex < currentIndex && !row.stripe_subscription_id) {
      await sql`UPDATE users SET plan = ${plan}, updated_at = now() WHERE id = ${userId}`;
      await ensurePeriod(userId);
      return getSubscription(userId);
    }

    throw new Error('Use Upgrade to subscribe to a paid plan.');
  }

  async function createBillingPortalSession(userId) {
    if (!stripe) throw new Error('Billing is not configured.');
    const row = await getUserBillingRow(userId);
    if (!row?.stripe_customer_id) {
      throw new Error('No billing account yet. Subscribe to a paid plan first.');
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${frontendUrl}?page=plan`,
    });
    return session.url;
  }

  return {
    PLAN_ORDER,
    PLAN_LIMITS,
    PLAN_PRICE_CENTS,
    PLAN_LABELS,
    getSubscription,
    ensurePeriod,
    canSendEmail,
    canSendSms,
    incrementEmail,
    incrementSms,
    handleStripeWebhookEvent,
    createCheckoutSession,
    confirmCheckout,
    updatePlan,
    createBillingPortalSession,
  };
}
