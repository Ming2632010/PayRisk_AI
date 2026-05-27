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

function addMonthsDate(dateStr, months = 1) {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return isoDate(d);
}

function unixToIsoDate(unixSeconds) {
  if (!unixSeconds) return null;
  return isoDate(new Date(unixSeconds * 1000));
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
        SELECT id, email, plan, period_start, period_end,
               emails_sent_current_period, sms_sent_current_period,
               stripe_customer_id, stripe_subscription_id, subscription_status,
               subscription_renewal_reminder_sent_at
        FROM users WHERE id = ${userId}
      `;
      return rows[0] ?? null;
    } catch (e) {
      if (!e.message || !/stripe_|subscription_|period_end|column/.test(e.message)) throw e;
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
      };
    }
  }

  async function resetUsagePeriod(userId, periodStart, periodEnd, extra = {}) {
    const { plan, subscriptionStatus, stripeCustomerId, stripeSubscriptionId } = extra;
    try {
      if (plan !== undefined) {
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
            updated_at = now()
          WHERE id = ${userId}
        `;
      }
    } catch (e) {
      if (!e.message || !/stripe_|subscription_|period_end|column/.test(e.message)) throw e;
      await sql`
        UPDATE users SET
          plan = COALESCE(${plan ?? null}, plan),
          period_start = ${periodStart},
          emails_sent_current_period = 0,
          sms_sent_current_period = 0,
          updated_at = now()
        WHERE id = ${userId}
      `;
    }
  }

  async function syncUserFromSubscription(userId, sub, { resetUsage = false } = {}) {
    const plan = await resolvePlanFromSubscription(sub);
    if (!plan) {
      console.error('Stripe sync: could not resolve plan for subscription', sub.id);
      return;
    }
    const periodStart = unixToIsoDate(sub.current_period_start);
    const periodEnd = unixToIsoDate(sub.current_period_end);
    const status = sub.status || 'none';
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;

    if (resetUsage) {
      await resetUsagePeriod(userId, periodStart, periodEnd, {
        plan,
        subscriptionStatus: status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
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

  async function ensurePeriod(userId) {
    const row = await getUserBillingRow(userId);
    if (!row) return;

    const plan = row.plan || 'starter';
    const today = isoDate(new Date());
    const hasActivePaidSub =
      row.stripe_subscription_id &&
      ACTIVE_SUB_STATUSES.has(String(row.subscription_status || ''));

    // Paid subscribers: usage resets on invoice.paid (webhook), not on calendar boundaries.
    if (hasActivePaidSub && PAID_PLANS.includes(plan)) return;

    let start = row.period_start ? String(row.period_start).slice(0, 10) : today;
    let end = row.period_end ? String(row.period_end).slice(0, 10) : addMonthsDate(start, 1);

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

  async function getSubscription(userId) {
    await ensurePeriod(userId);
    const row = await getUserBillingRow(userId);
    if (!row) return null;

    const plan = row.plan || 'starter';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
    const status = row.subscription_status || 'none';
    const today = isoDate(new Date());

    let periodEnd = row.period_end ? String(row.period_end).slice(0, 10) : null;
    const periodStart = row.period_start ? String(row.period_start).slice(0, 10) : null;

    // Legacy accounts: paid plan from one-time checkout before recurring billing (no Stripe sub id).
    if (PAID_PLANS.includes(plan) && !row.stripe_subscription_id && !periodEnd && periodStart) {
      periodEnd = addMonthsDate(periodStart, 1);
      try {
        await sql`UPDATE users SET period_end = ${periodEnd}, updated_at = now() WHERE id = ${userId}`;
      } catch (_) { /* optional column */ }
    }

    const stripeActive = ACTIVE_SUB_STATUSES.has(status) && PAID_PLANS.includes(plan);
    const legacyPaidActive =
      PAID_PLANS.includes(plan) &&
      !row.stripe_subscription_id &&
      periodEnd != null &&
      today <= periodEnd;

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
      has_active_subscription: stripeActive || legacyPaidActive,
      cancel_at_period_end: cancelAtPeriodEnd,
      next_billing_date: periodEnd,
    };
  }

  async function canSendEmail(userId) {
    await ensurePeriod(userId);
    const sub = await getSubscription(userId);
    if (!sub) return { ok: false, error: 'User not found', code: 'USER_NOT_FOUND' };

    if (PAID_PLANS.includes(sub.plan) && !sub.has_active_subscription) {
      return {
        ok: false,
        error: 'Your subscription is not active. Open the Plan page to update billing or renew.',
        code: 'SUBSCRIPTION_INACTIVE',
      };
    }

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
    await ensurePeriod(userId);
    const sub = await getSubscription(userId);
    if (!sub) return { ok: false, error: 'User not found', code: 'USER_NOT_FOUND' };

    if (PAID_PLANS.includes(sub.plan) && !sub.has_active_subscription) {
      return {
        ok: false,
        error: 'Your subscription is not active. Open the Plan page to update billing or renew.',
        code: 'SUBSCRIPTION_INACTIVE',
      };
    }

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
    const periodEnd = unixToIsoDate(invoice.period_end) || user.period_end;
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

      const sub = await stripe.subscriptions.retrieve(typeof subId === 'string' ? subId : subId.id);
      await syncUserFromSubscription(userId, sub, { resetUsage: true });
      return;
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      if (!invoice.subscription || !stripe) return;

      const sub = await stripe.subscriptions.retrieve(
        typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id,
      );
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

      const periodStart = unixToIsoDate(sub.current_period_start);
      const periodEnd = unixToIsoDate(sub.current_period_end);
      const plan = await resolvePlanFromSubscription(sub);
      if (!plan) return;

      await resetUsagePeriod(userId, periodStart, periodEnd, {
        plan,
        subscriptionStatus: sub.status,
        stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
        stripeSubscriptionId: sub.id,
      });
      return;
    }

    if (event.type === 'invoice.upcoming') {
      const invoice = event.data.object;
      if (!invoice.subscription || !stripe) return;

      const sub = await stripe.subscriptions.retrieve(
        typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id,
      );
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

      if (['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)) {
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

    const sub = await stripe.subscriptions.retrieve(typeof subId === 'string' ? subId : subId.id);
    await syncUserFromSubscription(userId, sub, { resetUsage: true });
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
