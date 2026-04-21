import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';
import { Resend } from 'resend';
import twilio from 'twilio';
import Stripe from 'stripe';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.AUTH_JWT_SECRET;
const sql = neon(process.env.NEON_DATABASE_URL);
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

if (!process.env.NEON_DATABASE_URL) {
  console.error('Missing NEON_DATABASE_URL');
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error('Missing AUTH_JWT_SECRET (use a long random string, e.g. openssl rand -base64 32)');
  process.exit(1);
}

app.use(cors({ origin: true, credentials: true }));

// Stripe webhook needs raw body for signature verification (must be before express.json())
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !stripeWebhookSecret) {
    return res.status(503).send('Stripe not configured');
  }
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing stripe-signature');
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
  } catch (e) {
    return res.status(400).send(`Webhook signature verification failed: ${e.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan;
    if (userId && plan && ['basic', 'professional', 'business'].includes(plan)) {
      try {
        await sql`UPDATE users SET plan = ${plan}, updated_at = now() WHERE id = ${userId}`;
      } catch (err) {
        console.error('Webhook: failed to update plan', err);
      }
    }
  }
  res.sendStatus(200);
});

app.use(express.json());

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.sub;
    req.userEmail = decoded.email;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// --- Auth (no authMiddleware) ---
app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;
    if (existing.length > 0) return res.status(400).json({ error: 'An account with this email already exists' });
    const id = randomUUID();
    const password_hash = await bcrypt.hash(password, 10);
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);
    const periodStartStr = periodStart.toISOString().slice(0, 10);
    await sql`
      INSERT INTO users (id, email, password_hash, plan, period_start, emails_sent_current_period, sms_sent_current_period)
      VALUES (${id}, ${normalizedEmail}, ${password_hash}, 'starter', ${periodStartStr}, 0, 0)
    `;
    const token = jwt.sign({ sub: id, email: normalizedEmail }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id, email: normalizedEmail } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const normalizedEmail = String(email).trim().toLowerCase();
    const rows = await sql`SELECT id, email, password_hash FROM users WHERE email = ${normalizedEmail}`;
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/auth/me', authMiddleware, (req, res) => {
  res.json({ id: req.userId, email: req.userEmail });
});

app.use('/api', authMiddleware);

// --- Plan limits (Option A: Starter 50 email only; Basic/Pro/Business email + SMS) ---
const PLAN_LIMITS = {
  starter: { emails: 50, sms: 0 },
  basic: { emails: 500, sms: 50 },
  professional: { emails: 2000, sms: 200 },
  business: { emails: 6000, sms: 600 },
};

async function getSubscription(userId) {
  const rows = await sql`
    SELECT plan, period_start, emails_sent_current_period, sms_sent_current_period
    FROM users WHERE id = ${userId}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  const plan = r.plan || 'starter';
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
  return {
    plan,
    period_start: r.period_start,
    emails_sent: Number(r.emails_sent_current_period ?? 0),
    sms_sent: Number(r.sms_sent_current_period ?? 0),
    emails_limit: limits.emails,
    sms_limit: limits.sms,
  };
}

function startOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

async function ensurePeriod(userId) {
  const now = startOfMonth();
  const rows = await sql`
    SELECT period_start FROM users WHERE id = ${userId}
  `;
  if (rows.length === 0) return;
  const periodStart = rows[0].period_start ? String(rows[0].period_start).slice(0, 10) : null;
  if (periodStart !== now) {
    await sql`
      UPDATE users SET period_start = ${now}, emails_sent_current_period = 0, sms_sent_current_period = 0
      WHERE id = ${userId}
    `;
  }
}

async function canSendEmail(userId) {
  await ensurePeriod(userId);
  const sub = await getSubscription(userId);
  if (!sub) return { ok: false, error: 'User not found' };
  if (sub.emails_sent >= sub.emails_limit) return { ok: false, error: 'Email limit reached for this period. Upgrade your plan.' };
  return { ok: true };
}

async function canSendSms(userId) {
  await ensurePeriod(userId);
  const sub = await getSubscription(userId);
  if (!sub) return { ok: false, error: 'User not found' };
  if (sub.sms_limit === 0) return { ok: false, error: 'SMS not included in your plan. Upgrade to Basic or higher.' };
  if (sub.sms_sent >= sub.sms_limit) return { ok: false, error: 'SMS limit reached for this period. Upgrade your plan.' };
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

const resendApi = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER || '';

/** Option A: platform From (verified in Resend) + merchant Reply-To. */
const REPLY_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function isValidReplyEmail(s) {
  return REPLY_EMAIL_RE.test(String(s ?? '').trim());
}

function friendlyFromLogin(loginEmail) {
  const local = String(loginEmail ?? '').trim().split('@')[0] || '';
  if (!local) return 'Your business';
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function sanitizeDisplayName(name) {
  let s = String(name ?? '').trim().replace(/[\r\n]+/g, ' ');
  s = s.replace(/[<>"\\]/g, '').trim().slice(0, 78);
  return s;
}

function parseInvoiceTemplateForSender(inv) {
  if (typeof inv !== 'object' || inv === null) {
    return { company_name: '', reply_email: '' };
  }
  return {
    company_name: String(inv.company_name ?? '').trim(),
    reply_email: String(inv.email ?? '').trim(),
  };
}

/** Reply-To for all customer-facing mail: invoice template email if valid, else login email. */
function merchantReplyTo(invSnip, loginEmail) {
  if (isValidReplyEmail(invSnip.reply_email)) return invSnip.reply_email.trim().toLowerCase();
  return loginEmail;
}

/** Resend `from`: optional "Name <email@verified.domain>"; if env is already "Name <...>", pass through. */
function formatResendFrom(displayName, bareFrom) {
  const addr = String(bareFrom ?? '').trim() || 'onboarding@resend.dev';
  if (addr.includes('<') && addr.includes('>')) return addr;
  const dn = sanitizeDisplayName(displayName);
  if (dn) return `${dn} <${addr}>`;
  return addr;
}

// --- Subscription & due today ---
app.get('/api/subscription', async (req, res) => {
  try {
    await ensurePeriod(req.userId);
    const sub = await getSubscription(req.userId);
    if (!sub) return res.status(404).json({ error: 'Not found' });
    res.json(sub);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const PLAN_ORDER = ['starter', 'basic', 'professional', 'business'];
const PLAN_PRICE_CENTS = { starter: 0, basic: 1900, professional: 4900, business: 9900 };
const PLAN_LABELS = { starter: 'Starter', basic: 'Basic', professional: 'Professional', business: 'Business' };

app.post('/api/subscription/checkout-session', async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Billing is not configured. Set STRIPE_SECRET_KEY in server environment.' });
    const plan = req.body?.plan;
    if (!plan || !PLAN_ORDER.includes(plan)) return res.status(400).json({ error: 'Invalid plan.' });
    if (PLAN_PRICE_CENTS[plan] === 0) return res.status(400).json({ error: 'Starter is free. Use the plan switch for downgrades.' });
    const sub = await getSubscription(req.userId);
    if (!sub) return res.status(404).json({ error: 'Not found' });
    const currentIndex = PLAN_ORDER.indexOf(sub.plan);
    const targetIndex = PLAN_ORDER.indexOf(plan);
    if (targetIndex <= currentIndex) return res.status(400).json({ error: 'Use the plan switch below for downgrades or the same plan.' });
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: PLAN_PRICE_CENTS[plan],
          product_data: { name: `PayRisk AI – ${PLAN_LABELS[plan]} (1 month)` },
        },
        quantity: 1,
      }],
      metadata: { userId: req.userId, plan },
      success_url: `${FRONTEND_URL}?page=plan&success=1`,
      cancel_url: `${FRONTEND_URL}?page=plan&cancel=1`,
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/subscription', async (req, res) => {
  try {
    const plan = req.body?.plan;
    if (!plan || !['starter', 'basic', 'professional', 'business'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Use starter, basic, professional, or business.' });
    }
    const rows = await sql`
      UPDATE users SET plan = ${plan}, updated_at = now()
      WHERE id = ${req.userId}
      RETURNING plan
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await ensurePeriod(req.userId);
    const sub = await getSubscription(req.userId);
    res.json(sub);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/customers/due-today', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await sql`
      SELECT id, name, email, amount_owed, due_date
      FROM customers
      WHERE user_id = ${req.userId} AND due_date = ${today} AND (amount_owed IS NULL OR amount_owed > 0)
      ORDER BY name
    `;
    res.json({ count: rows.length, customers: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// --- Customers ---
app.get('/api/customers', async (req, res) => {
  try {
    const rows = await sql`
      SELECT * FROM customers
      WHERE user_id = ${req.userId}
      ORDER BY created_at DESC
    `;
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const b = req.body;
    const row = await sql`
      INSERT INTO customers (
        user_id, name, email, phone, company, street_address, city, state_province,
        postal_code, country, amount_owed, due_date, total_orders, average_order_value,
        last_purchase_date, is_high_risk_industry, tags
      ) VALUES (
        ${req.userId}, ${b.name}, ${b.email}, ${b.phone ?? null}, ${b.company ?? null},
        ${b.street_address ?? null}, ${b.city ?? null}, ${b.state_province ?? null},
        ${b.postal_code ?? null}, ${b.country ?? null},
        ${b.amount_owed != null ? Number(b.amount_owed) : 0},
        ${b.due_date || null}, ${b.total_orders != null ? Number(b.total_orders) : 0},
        ${b.average_order_value != null ? Number(b.average_order_value) : 0},
        ${b.last_purchase_date || null}, ${Boolean(b.is_high_risk_industry)}, ${b.tags ?? []}
      )
      RETURNING *
    `;
    res.status(201).json(row[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body;
    const rows = await sql`
      UPDATE customers SET
        name = ${b.name}, email = ${b.email}, phone = ${b.phone ?? null}, company = ${b.company ?? null},
        street_address = ${b.street_address ?? null}, city = ${b.city ?? null},
        state_province = ${b.state_province ?? null}, postal_code = ${b.postal_code ?? null},
        country = ${b.country ?? null}, amount_owed = ${Number(b.amount_owed) ?? 0},
        due_date = ${b.due_date || null}, total_orders = ${Number(b.total_orders) ?? 0},
        average_order_value = ${Number(b.average_order_value) ?? 0},
        last_purchase_date = ${b.last_purchase_date || null},
        is_high_risk_industry = ${Boolean(b.is_high_risk_industry)}, tags = ${b.tags ?? []},
        updated_at = now()
      WHERE id = ${id} AND user_id = ${req.userId}
      RETURNING *
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await sql`
      DELETE FROM customers WHERE id = ${id} AND user_id = ${req.userId} RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/customers/import', async (req, res) => {
  try {
    const list = Array.isArray(req.body) ? req.body : [];
    for (const b of list) {
      await sql`
        INSERT INTO customers (
          user_id, name, email, phone, company, street_address, city, state_province,
          postal_code, country, amount_owed, due_date, total_orders, average_order_value,
          last_purchase_date, is_high_risk_industry, tags
        ) VALUES (
          ${req.userId}, ${b.name}, ${b.email}, ${b.phone ?? null}, ${b.company ?? null},
          ${b.street_address ?? null}, ${b.city ?? null}, ${b.state_province ?? null},
          ${b.postal_code ?? null}, ${b.country ?? null}, ${Number(b.amount_owed) ?? 0},
          ${b.due_date || null}, ${Number(b.total_orders) ?? 0}, ${Number(b.average_order_value) ?? 0},
          ${b.last_purchase_date || null}, ${Boolean(b.is_high_risk_industry)}, ${b.tags ?? []}
        )
      `;
    }
    res.status(201).json({ imported: list.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// --- Customer notes (stored in customers.notes jsonb) ---
app.get('/api/customers/:id/notes', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await sql`
      SELECT notes FROM customers WHERE id = ${id} AND user_id = ${req.userId}
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const notes = rows[0].notes;
    res.json(Array.isArray(notes) ? notes : []);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/customers/:id/notes', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const notes = Array.isArray(req.body) ? req.body : [];
    const rows = await sql`
      UPDATE customers SET notes = ${JSON.stringify(notes)}, updated_at = now()
      WHERE id = ${id} AND user_id = ${req.userId}
      RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ notes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// --- Send email (Resend) and SMS (Twilio) ---
app.post('/api/customers/:id/send-reminder', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const check = await canSendEmail(req.userId);
    if (!check.ok) return res.status(403).json({ error: check.error });
    const rows = await sql`SELECT id, name, email, amount_owed, due_date FROM customers WHERE id = ${id} AND user_id = ${req.userId}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    const c = rows[0];
    if (!resendApi) return res.status(503).json({ error: 'Email is not configured. Set RESEND_API_KEY and FROM_EMAIL in server environment.' });
    const amountOwed = c.amount_owed != null ? Number(c.amount_owed) : 0;
    const dueDateStr = c.due_date ? String(c.due_date).slice(0, 10) : '';
    const dueStr = dueDateStr ? ` by ${dueDateStr}` : '';
    let subject = DEFAULT_REMINDER.subject;
    let htmlBody = DEFAULT_REMINDER.body;
    let invSnip = { company_name: '', reply_email: '' };
    try {
      const tRows = await sql`SELECT reminder_template, invoice_template FROM users WHERE id = ${req.userId}`;
      invSnip = parseInvoiceTemplateForSender(tRows[0]?.invoice_template);
      const t = tRows[0]?.reminder_template;
      if (typeof t === 'object' && t !== null && t.subject) {
        subject = t.subject;
        htmlBody = t.body ?? '';
      }
    } catch (_) { /* columns may not exist yet; use defaults */ }
    const senderLabel = invSnip.company_name || friendlyFromLogin(req.userEmail);
    const vars = {
      customer_name: c.name,
      amount: `$${amountOwed.toFixed(2)}`,
      due_date: dueStr,
      your_name: senderLabel,
    };
    const html = `<p>${applyEmailTemplate(htmlBody, vars).replace(/<br>/g, '</p><p>')}</p>`;
    const replyTo = merchantReplyTo(invSnip, req.userEmail);
    const { error } = await resendApi.emails.send({
      from: formatResendFrom(senderLabel, fromEmail),
      to: c.email,
      replyTo,
      subject: applyEmailTemplate(subject, vars),
      html,
    });
    if (error) return res.status(500).json({ error: error.message || 'Failed to send email' });
    await incrementEmail(req.userId);
    res.json({ sent: true, channel: 'email' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/customers/:id/send-offer', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const check = await canSendEmail(req.userId);
    if (!check.ok) return res.status(403).json({ error: check.error });
    const rows = await sql`SELECT id, name, email FROM customers WHERE id = ${id} AND user_id = ${req.userId}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    const c = rows[0];
    if (!resendApi) return res.status(503).json({ error: 'Email is not configured. Set RESEND_API_KEY and FROM_EMAIL in server environment.' });
    let subject = DEFAULT_OFFER.subject;
    let htmlBody = DEFAULT_OFFER.body;
    let invSnip = { company_name: '', reply_email: '' };
    try {
      const tRows = await sql`SELECT offer_template, invoice_template FROM users WHERE id = ${req.userId}`;
      invSnip = parseInvoiceTemplateForSender(tRows[0]?.invoice_template);
      const t = tRows[0]?.offer_template;
      if (typeof t === 'object' && t !== null && t.subject) {
        subject = t.subject;
        htmlBody = t.body ?? '';
      }
    } catch (_) { /* columns may not exist yet; use defaults */ }
    const senderLabel = invSnip.company_name || friendlyFromLogin(req.userEmail);
    const vars = {
      customer_name: c.name,
      offer_details: 'contact us for details',
      your_name: senderLabel,
    };
    const html = `<p>${applyEmailTemplate(htmlBody, vars).replace(/<br>/g, '</p><p>')}</p>`;
    const replyTo = merchantReplyTo(invSnip, req.userEmail);
    const { error } = await resendApi.emails.send({
      from: formatResendFrom(senderLabel, fromEmail),
      to: c.email,
      replyTo,
      subject: applyEmailTemplate(subject, vars),
      html,
    });
    if (error) return res.status(500).json({ error: error.message || 'Failed to send email' });
    await incrementEmail(req.userId);
    res.json({ sent: true, channel: 'email' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/customers/:id/send-sms', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const check = await canSendSms(req.userId);
    if (!check.ok) return res.status(403).json({ error: check.error });
    const rows = await sql`SELECT id, name, phone, amount_owed, due_date FROM customers WHERE id = ${id} AND user_id = ${req.userId}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    const c = rows[0];
    const phone = (req.body?.phone || c.phone || '').trim().replace(/\D/g, '');
    if (!phone || phone.length < 10) return res.status(400).json({ error: 'Customer has no valid phone number for SMS.' });
    const body = req.body?.message || `Hi ${c.name}, friendly reminder: you have an outstanding balance. Please contact us to arrange payment.`;
    if (!twilioClient || !twilioPhone) return res.status(503).json({ error: 'SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in server environment.' });
    const to = phone.length === 10 ? `+1${phone}` : `+${phone}`;
    await twilioClient.messages.create({ body, from: twilioPhone, to });
    await incrementSms(req.userId);
    res.json({ sent: true, channel: 'sms' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// --- Email templates (reminder + offer; used by send-reminder / send-offer) ---
const DEFAULT_REMINDER = { subject: 'Payment reminder', body: 'Hi {{customer_name}},\n\nThis is a friendly reminder that you have an outstanding balance of {{amount}} due{{due_date}}.\n\nPlease arrange payment at your earliest convenience.\n\nThanks,\n{{your_name}}' };
const DEFAULT_OFFER = { subject: 'Special offer for you', body: "Hi {{customer_name}},\n\nWe have a special offer we think you'll love. Get in touch with us to learn more!\n\nBest regards,\n{{your_name}}" };

app.get('/api/email-templates', async (req, res) => {
  try {
    const rows = await sql`SELECT reminder_template, offer_template FROM users WHERE id = ${req.userId}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = rows[0].reminder_template;
    const o = rows[0].offer_template;
    res.json({
      reminder: (typeof r === 'object' && r !== null && r.subject != null) ? { subject: r.subject, body: r.body ?? '' } : DEFAULT_REMINDER,
      offer: (typeof o === 'object' && o !== null && o.subject != null) ? { subject: o.subject, body: o.body ?? '' } : DEFAULT_OFFER,
    });
  } catch (e) {
    if (e.message && /reminder_template|offer_template|column/.test(e.message)) {
      return res.json({ reminder: DEFAULT_REMINDER, offer: DEFAULT_OFFER });
    }
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/email-templates', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const reminder = {
      subject: (body.reminder?.subject != null ? String(body.reminder.subject) : DEFAULT_REMINDER.subject).slice(0, 500),
      body: (body.reminder?.body != null ? String(body.reminder.body) : DEFAULT_REMINDER.body).slice(0, 10000),
    };
    const offer = {
      subject: (body.offer?.subject != null ? String(body.offer.subject) : DEFAULT_OFFER.subject).slice(0, 500),
      body: (body.offer?.body != null ? String(body.offer.body) : DEFAULT_OFFER.body).slice(0, 10000),
    };
    await sql`
      UPDATE users SET reminder_template = ${JSON.stringify(reminder)}, offer_template = ${JSON.stringify(offer)}, updated_at = now()
      WHERE id = ${req.userId}
    `;
    res.json({ reminder, offer });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

function applyEmailTemplate(body, vars) {
  let out = String(body ?? '');
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return out.replace(/\n/g, '<br>');
}

// --- Invoice template (your company details + tax settings for the invoice) ---
/** Default tax settings: GST @ 10%, enabled, exclusive. New users in AU get the right defaults out of the box. */
const DEFAULT_TAX = { tax_enabled: true, tax_label: 'GST', tax_rate: 10, tax_inclusive: false };

/** Normalize a raw invoice_template value into the full template shape (company fields + tax). */
function normalizeInvoiceTemplate(raw) {
  const t = typeof raw === 'object' && raw !== null ? raw : {};
  const rateNum = Number(t.tax_rate);
  return {
    company_name: t.company_name ?? '',
    contact_name: t.contact_name ?? '',
    email: t.email ?? '',
    phone: t.phone ?? '',
    address: t.address ?? '',
    tax_id: t.tax_id ?? '',
    footer_notes: t.footer_notes ?? '',
    tax_enabled: typeof t.tax_enabled === 'boolean' ? t.tax_enabled : DEFAULT_TAX.tax_enabled,
    tax_label: (t.tax_label ?? '').toString().trim() || DEFAULT_TAX.tax_label,
    tax_rate: Number.isFinite(rateNum) ? Math.max(0, Math.min(100, rateNum)) : DEFAULT_TAX.tax_rate,
    tax_inclusive: typeof t.tax_inclusive === 'boolean' ? t.tax_inclusive : DEFAULT_TAX.tax_inclusive,
  };
}

app.get('/api/invoice-template', async (req, res) => {
  try {
    const rows = await sql`SELECT invoice_template FROM users WHERE id = ${req.userId}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(normalizeInvoiceTemplate(rows[0].invoice_template));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/invoice-template', async (req, res) => {
  try {
    const template = normalizeInvoiceTemplate(req.body && typeof req.body === 'object' ? req.body : {});
    await sql`
      UPDATE users SET invoice_template = ${JSON.stringify(template)}, updated_at = now()
      WHERE id = ${req.userId}
    `;
    res.json(template);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// --- Invoice email template (subject + intro body shown above the invoice HTML) ---
const DEFAULT_INVOICE_EMAIL = {
  subject: 'Invoice {{invoice_number}} from {{your_name}} – {{total}}',
  body: 'Hi {{customer_name}},\n\nPlease find your invoice {{invoice_number}} below. The total amount due is {{total}}{{due_date}}.\n\nThanks,\n{{your_name}}',
};

app.get('/api/invoice-email-template', async (req, res) => {
  try {
    const rows = await sql`SELECT invoice_email_template FROM users WHERE id = ${req.userId}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const t = rows[0].invoice_email_template;
    if (typeof t === 'object' && t !== null && t.subject != null) {
      res.json({ subject: String(t.subject), body: String(t.body ?? '') });
    } else {
      res.json(DEFAULT_INVOICE_EMAIL);
    }
  } catch (e) {
    if (e.message && /invoice_email_template|column/.test(e.message)) {
      return res.json(DEFAULT_INVOICE_EMAIL);
    }
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/invoice-email-template', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const template = {
      subject: (body.subject != null ? String(body.subject) : DEFAULT_INVOICE_EMAIL.subject).slice(0, 500),
      body: (body.body != null ? String(body.body) : DEFAULT_INVOICE_EMAIL.body).slice(0, 10000),
    };
    await sql`
      UPDATE users SET invoice_email_template = ${JSON.stringify(template)}, updated_at = now()
      WHERE id = ${req.userId}
    `;
    res.json(template);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// --- Send invoice (email with invoice built from customer + transactions + template) ---
function money(n) { return `$${(Number(n) || 0).toFixed(2)}`; }

/**
 * Compute per-line price/tax/line-total and overall subtotal/tax/total from a set of transactions,
 * respecting tax-inclusive vs exclusive. When tax is disabled, tax_amount is 0 and prices pass through.
 */
function computeInvoiceTotals(transactions, template) {
  const enabled = !!template.tax_enabled;
  const rate = enabled ? Math.max(0, Number(template.tax_rate) || 0) : 0;
  const inclusive = !!template.tax_inclusive;
  const rateFactor = rate / 100;

  const lines = (transactions || []).map((t) => {
    const amount = Number(t.amount) || 0;
    let price, tax, line;
    if (!enabled || rate === 0) {
      price = amount; tax = 0; line = amount;
    } else if (inclusive) {
      // The stored amount already includes tax. Back it out so we can show it separately.
      line = amount;
      price = amount / (1 + rateFactor);
      tax = line - price;
    } else {
      // The stored amount is the pre-tax price. Add tax on top.
      price = amount;
      tax = amount * rateFactor;
      line = price + tax;
    }
    return {
      id: t.id,
      date: t.date ? String(t.date).slice(0, 10) : '',
      description: t.description || 'Order',
      price,
      tax,
      line,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.price, 0);
  const tax_amount = lines.reduce((s, l) => s + l.tax, 0);
  const total = subtotal + tax_amount;
  return { lines, subtotal, tax_amount, total, rate, enabled, inclusive };
}

function buildInvoiceHtml(customer, transactions, template, opts = {}) {
  const tpl = normalizeInvoiceTemplate(template);
  const company = tpl.company_name || 'Your Company';
  const contact = tpl.contact_name;
  const companyEmail = tpl.email;
  const companyPhone = tpl.phone;
  const companyAddress = (tpl.address || '').replace(/\n/g, '<br>');
  const taxId = tpl.tax_id;
  const footerNotes = (tpl.footer_notes || '').replace(/\n/g, '<br>');
  const toName = customer.name;
  const toCompany = customer.company || '';
  const toAddress = [customer.street_address, [customer.city, customer.state_province, customer.postal_code].filter(Boolean).join(' '), customer.country].filter(Boolean).join('<br>');
  const invoiceDate = new Date().toISOString().slice(0, 10);
  const dueDate = customer.due_date ? String(customer.due_date).slice(0, 10) : invoiceDate;
  const invoiceNumber = opts.invoiceNumber || '';
  const introHtml = opts.introHtml || '';

  const { lines, subtotal, tax_amount, total, rate, enabled, inclusive } = computeInvoiceTotals(transactions, tpl);
  const showTax = enabled && rate > 0;
  const taxHeader = showTax ? `<th style="text-align:right">${escapeHtml(tpl.tax_label)} (${rate}%)</th>` : '';
  const rowsHtml = lines.length > 0
    ? lines.map((l) => `<tr>
        <td>${escapeHtml(l.date)}</td>
        <td>${escapeHtml(l.description)}</td>
        <td style="text-align:right">${money(l.price)}</td>
        ${showTax ? `<td style="text-align:right">${money(l.tax)}</td>` : ''}
        <td style="text-align:right">${money(l.line)}</td>
      </tr>`).join('')
    : `<tr><td colspan="${showTax ? 5 : 4}">No line items</td></tr>`;

  const inclusiveNote = showTax && inclusive ? `<div style="font-size:0.85em;color:#666;margin-top:-8px">Amounts are tax-inclusive. Tax shown is included in the line price.</div>` : '';

  const totalsBlock = showTax
    ? `<table style="width: 320px; margin-left:auto; border:none">
         <tr><td style="border:none;padding:4px 8px">Subtotal</td><td style="border:none;padding:4px 8px;text-align:right">${money(subtotal)}</td></tr>
         <tr><td style="border:none;padding:4px 8px">${escapeHtml(tpl.tax_label)} (${rate}%)</td><td style="border:none;padding:4px 8px;text-align:right">${money(tax_amount)}</td></tr>
         <tr><td style="border:none;padding:8px;font-weight:bold;border-top:2px solid #333">Total due</td><td style="border:none;padding:8px;text-align:right;font-weight:bold;border-top:2px solid #333">${money(total)}</td></tr>
       </table>`
    : `<div class="total">Total due: ${money(total)}</div>`;

  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body { font-family: system-ui, sans-serif; color: #333; max-width: 700px; margin: 0 auto; padding: 24px; }
  .intro { margin-bottom: 28px; padding-bottom: 16px; border-bottom: 1px solid #eee; white-space: pre-wrap; }
  .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
  .to { margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
  th { background: #f5f5f5; }
  .total { font-size: 1.2em; font-weight: bold; text-align: right; }
  .footer { margin-top: 32px; font-size: 0.9em; color: #666; }
</style></head><body>
  ${introHtml ? `<div class="intro">${introHtml}</div>` : ''}
  <div class="header">
    <div>
      <strong style="font-size: 1.3em;">${escapeHtml(company)}</strong>
      ${contact ? `<br>${escapeHtml(contact)}` : ''}
      ${companyEmail ? `<br>${escapeHtml(companyEmail)}` : ''}
      ${companyPhone ? `<br>${escapeHtml(companyPhone)}` : ''}
      ${companyAddress ? `<br>${companyAddress}` : ''}
      ${taxId ? `<br>Tax ID: ${escapeHtml(taxId)}` : ''}
    </div>
    <div style="text-align:right">
      <strong>INVOICE</strong>
      ${invoiceNumber ? `<br>#${escapeHtml(invoiceNumber)}` : ''}
      <br>Date: ${invoiceDate}
      <br>Due: ${dueDate}
    </div>
  </div>
  <div class="to">
    <strong>Bill to</strong><br>
    ${escapeHtml(toName)}${toCompany ? `<br>${escapeHtml(toCompany)}` : ''}
    ${customer.email ? `<br>${escapeHtml(customer.email)}` : ''}
    ${toAddress ? `<br>${toAddress}` : ''}
  </div>
  <table>
    <thead><tr>
      <th>Date</th>
      <th>Description</th>
      <th style="text-align:right">Price</th>
      ${taxHeader}
      <th style="text-align:right">Line total</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  ${inclusiveNote}
  ${totalsBlock}
  ${footerNotes ? `<div class="footer">${footerNotes}</div>` : ''}
</body></html>`;
}

function escapeHtml(s) {
  if (s == null) return '';
  const str = String(s);
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Normalize & validate transaction_ids from request body (array of positive numbers). Returns [] if not provided. */
function parseTransactionIds(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
}

/**
 * Load transactions for invoicing. When `ids.length > 0`, returns only those (scoped to customer/user).
 * When `ids` is empty, falls back to all unpaid transactions (legacy behavior).
 */
async function fetchInvoiceTransactions(customerId, userId, ids) {
  if (Array.isArray(ids) && ids.length > 0) {
    return await sql`
      SELECT id, date, amount, description, paid_fully
      FROM transactions
      WHERE customer_id = ${customerId} AND user_id = ${userId} AND id = ANY(${ids})
      ORDER BY date DESC
    `;
  }
  return await sql`
    SELECT id, date, amount, description, paid_fully
    FROM transactions
    WHERE customer_id = ${customerId} AND user_id = ${userId} AND COALESCE(paid_fully, false) = false
    ORDER BY date DESC
  `;
}

async function loadCustomerForInvoice(id, userId) {
  const rows = await sql`
    SELECT id, name, email, company, street_address, city, state_province, postal_code, country, amount_owed, due_date
    FROM customers WHERE id = ${id} AND user_id = ${userId}
  `;
  return rows[0] || null;
}

async function loadInvoiceTemplate(userId) {
  const userRows = await sql`SELECT invoice_template FROM users WHERE id = ${userId}`;
  return normalizeInvoiceTemplate(userRows[0]?.invoice_template);
}

async function loadInvoiceEmailTemplate(userId) {
  try {
    const rows = await sql`SELECT invoice_email_template FROM users WHERE id = ${userId}`;
    const t = rows[0]?.invoice_email_template;
    if (typeof t === 'object' && t !== null && t.subject != null) {
      return { subject: String(t.subject), body: String(t.body ?? '') };
    }
  } catch (_) { /* column may not exist yet */ }
  return DEFAULT_INVOICE_EMAIL;
}

function formatInvoiceNumber(n) {
  return `INV-${String(Math.max(1, Number(n) || 1)).padStart(4, '0')}`;
}

/** Peek the next invoice number for this user without consuming it (used for preview). */
async function peekNextInvoiceNumber(userId) {
  try {
    const rows = await sql`SELECT COALESCE(invoice_counter, 0) AS n FROM users WHERE id = ${userId}`;
    return formatInvoiceNumber(Number(rows[0]?.n ?? 0) + 1);
  } catch (_) {
    return formatInvoiceNumber(1);
  }
}

/** Atomically increment this user's invoice counter and return the new INV-XXXX string. */
async function allocateInvoiceNumber(userId) {
  const rows = await sql`
    UPDATE users SET invoice_counter = COALESCE(invoice_counter, 0) + 1, updated_at = now()
    WHERE id = ${userId}
    RETURNING invoice_counter
  `;
  return formatInvoiceNumber(rows[0]?.invoice_counter ?? 1);
}

/** Render the invoice email subject/body template with the computed invoice figures. */
function renderInvoiceEmailVars(emailTemplate, ctx) {
  const dueStr = ctx.due_date ? ` by ${ctx.due_date}` : '';
  const vars = {
    customer_name: ctx.customer_name,
    invoice_number: ctx.invoice_number,
    subtotal: money(ctx.subtotal),
    tax_amount: money(ctx.tax_amount),
    tax_label: ctx.tax_label,
    total: money(ctx.total),
    due_date: dueStr,
    your_name: ctx.your_name,
  };
  return {
    subject: applyInvoiceTemplateVars(emailTemplate.subject, vars),
    introHtml: applyEmailTemplate(emailTemplate.body, vars),
  };
}

/** Subject-safe variable substitution: does NOT convert newlines to <br> (used for the subject line). */
function applyInvoiceTemplateVars(str, vars) {
  let out = String(str ?? '');
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }
  return out;
}

// Read-only: returns invoice HTML + totals + subject for the chosen transactions so the UI can preview before sending.
app.post('/api/customers/:id/invoice-preview', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const customer = await loadCustomerForInvoice(id, req.userId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const ids = parseTransactionIds(req.body?.transaction_ids);
    const txRows = await fetchInvoiceTransactions(id, req.userId, ids);
    const template = await loadInvoiceTemplate(req.userId);
    const emailTpl = await loadInvoiceEmailTemplate(req.userId);
    const invoiceNumber = await peekNextInvoiceNumber(req.userId);
    const { subtotal, tax_amount, total } = computeInvoiceTotals(txRows, template);
    const invSnip = parseInvoiceTemplateForSender(template);
    const senderLabel = invSnip.company_name || friendlyFromLogin(req.userEmail);
    const { subject, introHtml } = renderInvoiceEmailVars(emailTpl, {
      customer_name: customer.name,
      invoice_number: invoiceNumber,
      subtotal, tax_amount, total,
      tax_label: template.tax_label,
      due_date: customer.due_date ? String(customer.due_date).slice(0, 10) : '',
      your_name: senderLabel,
    });
    const html = buildInvoiceHtml(customer, txRows, template, { invoiceNumber, introHtml });
    res.json({ html, subject, subtotal, tax_amount, total, count: txRows.length, invoice_number: invoiceNumber });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/customers/:id/send-invoice', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const check = await canSendEmail(req.userId);
    if (!check.ok) return res.status(403).json({ error: check.error });
    const customer = await loadCustomerForInvoice(id, req.userId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const ids = parseTransactionIds(req.body?.transaction_ids);
    const txRows = await fetchInvoiceTransactions(id, req.userId, ids);
    if (txRows.length === 0) return res.status(400).json({ error: 'No transactions selected for this invoice.' });
    const template = await loadInvoiceTemplate(req.userId);
    const emailTpl = await loadInvoiceEmailTemplate(req.userId);
    if (!resendApi) return res.status(503).json({ error: 'Email is not configured. Set RESEND_API_KEY and FROM_EMAIL in server environment.' });

    const { subtotal, tax_amount, total } = computeInvoiceTotals(txRows, template);
    const invoiceNumber = await allocateInvoiceNumber(req.userId);
    const invSnip = parseInvoiceTemplateForSender(template);
    const senderLabel = invSnip.company_name || friendlyFromLogin(req.userEmail);
    const { subject, introHtml } = renderInvoiceEmailVars(emailTpl, {
      customer_name: customer.name,
      invoice_number: invoiceNumber,
      subtotal, tax_amount, total,
      tax_label: template.tax_label,
      due_date: customer.due_date ? String(customer.due_date).slice(0, 10) : '',
      your_name: senderLabel,
    });
    const html = buildInvoiceHtml(customer, txRows, template, { invoiceNumber, introHtml });
    const replyTo = merchantReplyTo(invSnip, req.userEmail);

    const { error } = await resendApi.emails.send({
      from: formatResendFrom(senderLabel, fromEmail),
      to: customer.email,
      replyTo,
      subject,
      html,
    });
    if (error) return res.status(500).json({ error: error.message || 'Failed to send email' });

    const txIds = txRows.map((t) => Number(t.id)).filter(Boolean);
    let savedId = null;
    try {
      const saved = await sql`
        INSERT INTO invoices (
          user_id, customer_id, invoice_number, subject, transaction_ids,
          subtotal, tax_amount, tax_label, tax_rate, tax_inclusive, total, sent_to, html
        ) VALUES (
          ${req.userId}, ${id}, ${invoiceNumber}, ${subject}, ${txIds},
          ${subtotal.toFixed(2)}, ${tax_amount.toFixed(2)}, ${template.tax_label},
          ${template.tax_rate}, ${template.tax_inclusive}, ${total.toFixed(2)},
          ${customer.email}, ${html}
        )
        RETURNING id
      `;
      savedId = saved[0]?.id ?? null;
    } catch (snapErr) {
      // Log but don't fail the response — the email has already gone out.
      console.error('Failed to persist invoice snapshot:', snapErr);
    }

    try {
      if (txIds.length > 0) {
        await sql`UPDATE transactions SET invoiced_at = now(), updated_at = now() WHERE id = ANY(${txIds}) AND user_id = ${req.userId}`;
      }
    } catch (stampErr) {
      console.error('Failed to stamp invoiced_at on transactions:', stampErr);
    }

    await sql`
      UPDATE customers SET last_invoice_sent_at = now(), updated_at = now()
      WHERE id = ${id} AND user_id = ${req.userId}
    `;
    await incrementEmail(req.userId);
    res.json({ sent: true, channel: 'email', invoice_id: savedId, invoice_number: invoiceNumber, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// List all saved invoices for a customer (no HTML, for lightweight lists).
app.get('/api/customers/:id/invoices', async (req, res) => {
  try {
    const id = Number(req.params.id);
    try {
      const rows = await sql`
        SELECT id, invoice_number, subject, subtotal, tax_amount, tax_label, tax_rate,
               tax_inclusive, total, sent_to, sent_at, array_length(transaction_ids, 1) AS tx_count
        FROM invoices
        WHERE customer_id = ${id} AND user_id = ${req.userId}
        ORDER BY sent_at DESC, id DESC
      `;
      res.json(rows);
    } catch (err) {
      if (err.message && /invoices|relation|column/.test(err.message)) return res.json([]);
      throw err;
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get a single saved invoice including the stored HTML snapshot.
app.get('/api/invoices/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    try {
      const rows = await sql`
        SELECT id, customer_id, invoice_number, subject, transaction_ids, subtotal, tax_amount,
               tax_label, tax_rate, tax_inclusive, total, sent_to, html, sent_at
        FROM invoices
        WHERE id = ${id} AND user_id = ${req.userId}
      `;
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch (err) {
      if (err.message && /invoices|relation|column/.test(err.message)) {
        return res.status(404).json({ error: 'Not found' });
      }
      throw err;
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// --- Recalc customer totals from transactions (amount_owed, due_date, total_orders, average_order_value, last_purchase_date) ---
async function recalcCustomerTotals(customerId) {
  const agg = await sql`
    SELECT
      COUNT(*)::int AS total_orders,
      COALESCE(SUM(amount), 0) AS total_amount,
      MAX(date) AS last_purchase_date,
      COALESCE(SUM(CASE WHEN COALESCE(paid_fully, false) = false THEN amount ELSE 0 END), 0) AS amount_owed,
      MIN(CASE WHEN COALESCE(paid_fully, false) = false AND due_date IS NOT NULL THEN due_date END) AS due_date
    FROM transactions
    WHERE customer_id = ${customerId}
  `;
  const a = agg[0];
  const totalOrders = a?.total_orders ?? 0;
  const totalAmount = Number(a?.total_amount ?? 0);
  const averageOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;
  await sql`
    UPDATE customers SET
      amount_owed = ${Number(a?.amount_owed ?? 0)},
      due_date = ${a?.due_date ?? null},
      total_orders = ${totalOrders},
      average_order_value = ${averageOrderValue},
      last_purchase_date = ${a?.last_purchase_date ?? null},
      updated_at = now()
    WHERE id = ${customerId}
  `;
}

// --- Transactions ---
app.get('/api/transactions', async (req, res) => {
  try {
    const customerId = Number(req.query.customer_id);
    if (!customerId) return res.status(400).json({ error: 'customer_id required' });
    const rows = await sql`
      SELECT t.*, c.name AS customer_name
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id AND c.user_id = ${req.userId}
      WHERE t.customer_id = ${customerId} AND t.user_id = ${req.userId}
      ORDER BY t.date DESC
    `;
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const b = req.body;
    const orderDate = b.date ?? b.order_date;
    const paidFully = Boolean(b.paid_fully);
    const paidAt = paidFully && (b.paid_at || orderDate) ? (b.paid_at || orderDate) : null;
    const row = await sql`
      INSERT INTO transactions (customer_id, user_id, date, amount, description, status, finish_date, due_date, paid_fully, paid_at)
      VALUES (
        ${Number(b.customer_id)}, ${req.userId}, ${orderDate}, ${Number(b.amount)},
        ${b.description ?? b.items_tasks ?? null}, ${b.status ?? 'completed'},
        ${b.finish_date || null}, ${b.due_date || null}, ${paidFully}, ${paidAt}
      )
      RETURNING *
    `;
    await recalcCustomerTotals(Number(b.customer_id));
    res.status(201).json(row[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body;
    const current = await sql`SELECT * FROM transactions WHERE id = ${id} AND user_id = ${req.userId}`;
    if (current.length === 0) return res.status(404).json({ error: 'Not found' });
    const c = current[0];
    const orderDate = b.date ?? b.order_date ?? c.date;
    const paidFully = b.paid_fully !== undefined ? Boolean(b.paid_fully) : c.paid_fully;
    const paidAt = paidFully ? (b.paid_at || c.paid_at || orderDate) : null;
    const rows = await sql`
      UPDATE transactions SET
        date = ${orderDate},
        amount = ${b.amount != null ? Number(b.amount) : c.amount},
        description = ${b.description !== undefined ? (b.description ?? null) : c.description},
        status = ${b.status ?? c.status},
        finish_date = ${b.finish_date !== undefined ? (b.finish_date || null) : c.finish_date},
        due_date = ${b.due_date !== undefined ? (b.due_date || null) : c.due_date},
        paid_fully = ${paidFully},
        paid_at = ${paidAt},
        updated_at = now()
      WHERE id = ${id} AND user_id = ${req.userId}
      RETURNING *
    `;
    await recalcCustomerTotals(Number(rows[0].customer_id));
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await sql`
      DELETE FROM transactions WHERE id = ${id} AND user_id = ${req.userId} RETURNING customer_id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await recalcCustomerTotals(Number(rows[0].customer_id));
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
