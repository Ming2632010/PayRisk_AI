import { useState, useEffect } from 'react';
import { Mail, MessageSquare, Check, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import { api, type Subscription } from '../lib/api';

/** URL of the website where users manage plans and billing (Opened in system browser for store compliance). */
function getBillingWebsiteUrl(): string {
  const base =
    typeof import.meta.env.VITE_APP_URL === 'string' && import.meta.env.VITE_APP_URL
      ? import.meta.env.VITE_APP_URL.replace(/\/$/, '')
      : typeof window !== 'undefined'
        ? window.location.origin
        : '';
  return base ? `${base}?page=plan` : '';
}

/** True when running as a standalone PWA / app (store builds). When false, user is on the website in a browser and can use Stripe. */
function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

const PLAN_ORDER: Subscription['plan'][] = ['starter', 'basic', 'professional', 'business'];
const PLAN_LABELS: Record<Subscription['plan'], string> = {
  starter: 'Starter',
  basic: 'Basic',
  professional: 'Professional',
  business: 'Business',
};
/** Shown to users so it is clear Stripe charges in USD (not local currency on the label). */
const PLAN_PRICES: Record<Subscription['plan'], string> = {
  starter: '$0 USD',
  basic: '$19 USD',
  professional: '$49 USD',
  business: '$99 USD',
};
const PLAN_EMAILS: Record<Subscription['plan'], number> = {
  starter: 50,
  basic: 500,
  professional: 2000,
  business: 6000,
};
const PLAN_SMS: Record<Subscription['plan'], number> = {
  starter: 0,
  basic: 50,
  professional: 200,
  business: 600,
};

const UPGRADE_REASONS: Record<Subscription['plan'], string[]> = {
  starter: [
    'Send SMS (Basic and above)',
    'More emails per month (500 on Basic)',
    'Higher customer limits',
  ],
  basic: ['More emails (2,000) and SMS (200) on Professional', 'Better for growing teams'],
  professional: ['Maximum emails (6,000) and SMS (600) on Business', 'Best for high-volume use'],
  business: [],
};

const DOWNGRADE_NOTE: Record<Subscription['plan'], string> = {
  starter: 'You are on the free plan.',
  basic: 'Downgrading to Starter: you will lose SMS and be limited to 50 emails/month.',
  professional: 'Downgrading to Basic: 500 emails and 50 SMS/month.',
  business: 'Downgrading to Professional: 2,000 emails and 200 SMS/month.',
};

export default function SubscriptionPlan() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
      const sessionId = params.get('session_id');
      (async () => {
        setLoading(true);
        setError(null);
        try {
          if (sessionId) {
            const updated = await api.subscription.confirmCheckout(sessionId);
            setSub(updated);
          } else {
            await load();
          }
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : 'Could not confirm your payment. If you were charged, refresh this page in a moment or contact support with your account email.',
          );
          await load();
        } finally {
          const url = new URL(window.location.href);
          url.searchParams.delete('success');
          url.searchParams.delete('session_id');
          if (!url.searchParams.get('page')) {
            url.searchParams.set('page', 'plan');
          }
          const qs = url.searchParams.toString();
          window.history.replaceState({}, '', url.pathname + (qs ? `?${qs}` : ''));
          setLoading(false);
        }
      })();
      return;
    }
    load();
  }, []);

  async function load() {
    try {
      setError(null);
      const data = await api.subscription.get();
      setSub(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  }

  /** Opens the billing website in the system browser (App Store / Google Play compliant: no in-app payment link). */
  function openBillingWebsite() {
    const url = getBillingWebsiteUrl();
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else
      setError(
        'Billing website URL is not configured. Set VITE_APP_URL or open the app from the web.'
      );
  }

  async function changePlan(plan: Subscription['plan']) {
    if (!sub || sub.plan === plan) return;
    const currentIndex = PLAN_ORDER.indexOf(sub.plan);
    const targetIndex = PLAN_ORDER.indexOf(plan);
    const isUpgradeToPaid = targetIndex > currentIndex && plan !== 'starter';
    if (isUpgradeToPaid) {
      if (isStandaloneApp()) {
        openBillingWebsite();
        return;
      }
      setChanging(plan);
      setError(null);
      try {
        const { url } = await api.subscription.createCheckoutSession(plan);
        if (url) {
          window.location.href = url;
          return;
        }
        setError('Checkout could not be started. Please try again or contact support.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (
          msg.includes('not configured') ||
          msg.includes('503') ||
          msg.includes('Billing is not configured')
        ) {
          setError(
            'Payment is not set up yet. Add your Stripe keys (STRIPE_SECRET_KEY) to the server where your API runs to enable upgrades.'
          );
        } else {
          setError(msg || 'Failed to start checkout');
        }
      } finally {
        setChanging(null);
      }
      return;
    }
    setChanging(plan);
    setError(null);
    try {
      const updated = await api.subscription.update(plan);
      setSub(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update plan');
    } finally {
      setChanging(null);
    }
  }

  if (loading) return <div className="text-gray-500 py-8">Loading your plan...</div>;
  if (error && !sub) return <div className="text-red-600 py-4">{error}</div>;
  if (!sub) return null;

  const currentIndex = PLAN_ORDER.indexOf(sub.plan);
  const upgradePlans = PLAN_ORDER.slice(currentIndex + 1);
  const downgradePlans = PLAN_ORDER.slice(0, currentIndex).reverse();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Your plan</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage subscription and usage. Plans and billing are managed on our website.
        </p>
        <p className="text-sm text-slate-600 mt-2">
          <strong>Currency:</strong> prices on this page are in <strong>US dollars (USD)</strong>. Stripe
          charges in USD; your bank or card may show a converted amount in your local currency.
        </p>
      </div>

      {/* Current plan & usage */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-gray-500">Current plan</p>
            <p className="text-lg font-semibold text-gray-900">
              {PLAN_LABELS[sub.plan]} — {PLAN_PRICES[sub.plan]}/mo
            </p>
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                Emails: <strong>{sub.emails_sent}</strong> / {sub.emails_limit} this period
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                SMS: <strong>{sub.sms_sent}</strong> / {sub.sms_limit} this period
              </span>
            </div>
          </div>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>

      {/* Upgrade – on website: per-plan buttons to Stripe; in standalone app: single "Open website" button (store compliant) */}
      {upgradePlans.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <ArrowUp className="w-4 h-4 text-green-600" />
            Upgrade for more
          </h3>
          <ul className="space-y-2 mb-3 text-sm text-gray-600">
            {UPGRADE_REASONS[sub.plan].map((reason, i) => (
              <li key={i} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                {reason}
              </li>
            ))}
          </ul>
          {isStandaloneApp() ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                To upgrade, manage your plan, or pay for a subscription, use our website. Plans and
                billing are not processed in this app.
              </p>
              <button
                type="button"
                onClick={openBillingWebsite}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                Open website to upgrade or manage billing
              </button>
            </>
          ) : (
            <div className="flex flex-wrap gap-3">
              {upgradePlans.map((plan) => (
                <button
                  key={plan}
                  onClick={() => changePlan(plan)}
                  disabled={changing !== null}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {changing === plan
                    ? 'Redirecting...'
                    : `Upgrade to ${PLAN_LABELS[plan]} (${PLAN_PRICES[plan]}/mo)`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Downgrade */}
      {downgradePlans.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <ArrowDown className="w-4 h-4 text-amber-600" />
            Downgrade
          </h3>
          <p className="text-sm text-gray-600 mb-3">{DOWNGRADE_NOTE[sub.plan]}</p>
          <div className="flex flex-wrap gap-3">
            {downgradePlans.map((plan) => (
              <button
                key={plan}
                onClick={() => changePlan(plan)}
                disabled={changing !== null}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
              >
                {changing === plan
                  ? 'Updating...'
                  : `Switch to ${PLAN_LABELS[plan]} (${PLAN_PRICES[plan]}/mo)`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Plan comparison */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Plan</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Price (USD / mo)</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Emails/mo</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">SMS/mo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {PLAN_ORDER.map((plan) => (
              <tr key={plan} className={sub.plan === plan ? 'bg-blue-50' : ''}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {PLAN_LABELS[plan]} {sub.plan === plan && '(current)'}
                </td>
                <td className="px-4 py-3 text-gray-600">{PLAN_PRICES[plan]}</td>
                <td className="px-4 py-3 text-gray-600">{PLAN_EMAILS[plan]}</td>
                <td className="px-4 py-3 text-gray-600">{PLAN_SMS[plan]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
