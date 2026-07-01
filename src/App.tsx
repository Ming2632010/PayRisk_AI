import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  Users,
  Mail,
  LogOut,
  Sliders,
  CreditCard,
  Bell,
  Building2,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { getToken, clearAuth } from './lib/auth';
import { api, type DueTodayResponse } from './lib/api';
import type { AuthUser } from './lib/auth';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { CustomerManagement } from './components/CustomerManagement';
import EmailSettings from './components/EmailSettings';
import CustomRules from './components/CustomRules';
import SubscriptionPlan from './components/SubscriptionPlan';
import InvoiceTemplateSettings from './components/InvoiceTemplateSettings';

type Page = 'dashboard' | 'customers' | 'email-settings' | 'invoice' | 'custom-rules' | 'plan';

const VALID_PAGES: Page[] = [
  'dashboard',
  'customers',
  'email-settings',
  'invoice',
  'custom-rules',
  'plan',
];

const NAV_ITEMS: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'email-settings', label: 'Email Templates', icon: Mail },
  { id: 'invoice', label: 'Business profile', icon: Building2 },
  { id: 'custom-rules', label: 'Custom Rules', icon: Sliders },
  { id: 'plan', label: 'Plan', icon: CreditCard },
];

/** Keep the address bar in sync with the active section (Stripe redirects use ?page=plan&cancel=1, etc.). */
function syncPageToUrl(page: Page) {
  const url = new URL(window.location.href);
  url.searchParams.delete('success');
  url.searchParams.delete('cancel');
  if (page === 'dashboard') {
    url.search = '';
  } else {
    url.searchParams.set('page', page);
  }
  const qs = url.searchParams.toString();
  window.history.replaceState({}, '', url.pathname + (qs ? `?${qs}` : ''));
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [dueToday, setDueToday] = useState<DueTodayResponse | null>(null);
  const [businessName, setBusinessName] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (!user) {
      setBusinessName('');
      return;
    }
    let alive = true;
    const load = () => {
      api.invoiceTemplate
        .get()
        .then((t) => {
          if (!alive) return;
          setBusinessName(String(t?.company_name ?? '').trim());
        })
        .catch(() => {
          if (alive) setBusinessName('');
        });
    };
    load();
    function onUpdate() {
      load();
    }
    window.addEventListener('business-profile-updated', onUpdate);
    return () => {
      alive = false;
      window.removeEventListener('business-profile-updated', onUpdate);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('page');
    const next: Page =
      raw && VALID_PAGES.includes(raw as Page) ? (raw as Page) : 'dashboard';
    setCurrentPage(next);
    syncPageToUrl(next);
  }, [user]);

  function navigateTo(page: Page) {
    setCurrentPage(page);
    setMobileMenuOpen(false);
    syncPageToUrl(page);
  }

  useEffect(() => {
    if (!user) return;
    api.customers.dueToday().then(setDueToday).catch(() => setDueToday(null));
    const t = setInterval(() => {
      api.customers.dueToday().then(setDueToday).catch(() => setDueToday(null));
    }, 60_000);
    return () => clearInterval(t);
  }, [user]);

  async function checkUser() {
    try {
      if (!getToken()) {
        setUser(null);
        return;
      }
      const me = await api.auth.me();
      setUser(me);
    } catch {
      clearAuth();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSignOut() {
    clearAuth();
    setUser(null);
    setMobileMenuOpen(false);
  }

  function navButtonClass(active: boolean, fullWidth = false) {
    return [
      'flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors text-sm',
      fullWidth ? 'w-full text-left' : '',
      active ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={checkUser} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg sm:text-xl font-bold text-gray-900 truncate">PayRisk AI</span>
              </div>

              <div className="hidden lg:flex gap-1 ml-4">
                {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => navigateTo(id)}
                    className={navButtonClass(currentPage === id)}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <div
                className="hidden sm:block text-right leading-tight max-w-[10rem] md:max-w-xs"
                title={businessName ? `Signed in as ${user.email}` : undefined}
              >
                <div className="text-sm font-medium text-gray-900 truncate">
                  {businessName || user.email}
                </div>
                {businessName && (
                  <div className="text-xs text-gray-500 truncate">{user.email}</div>
                )}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Sign Out</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="lg:hidden p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-1">
            <div className="sm:hidden pb-2 mb-2 border-b border-gray-100">
              <div className="text-sm font-medium text-gray-900 truncate">
                {businessName || user.email}
              </div>
              {businessName && (
                <div className="text-xs text-gray-500 truncate">{user.email}</div>
              )}
            </div>
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => navigateTo(id)}
                className={navButtonClass(currentPage === id, true)}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleSignOut}
              className="flex sm:hidden items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </nav>

      {dueToday && dueToday.count > 0 && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                {dueToday.count} customer{dueToday.count !== 1 ? 's' : ''} with payment due today.
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('customers')}
              className="text-sm font-medium text-amber-800 underline hover:no-underline"
            >
              Go to Customers to send reminder or SMS
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentPage === 'dashboard' && <Dashboard onOpenPlanPage={() => navigateTo('plan')} />}
        {currentPage === 'customers' && (
          <CustomerManagement
            userId={user?.id ?? null}
            onDueTodayRefresh={() => api.customers.dueToday().then(setDueToday).catch(() => setDueToday(null))}
            onOpenPlanPage={() => navigateTo('plan')}
          />
        )}
        {currentPage === 'email-settings' && <EmailSettings />}
        {currentPage === 'invoice' && <InvoiceTemplateSettings />}
        {currentPage === 'custom-rules' && <CustomRules />}
        {currentPage === 'plan' && <SubscriptionPlan />}
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 text-center text-xs text-gray-500">
        <Link to="/privacy" className="text-blue-600 hover:underline">
          Privacy Policy
        </Link>
        <span className="mx-2">·</span>
        <Link to="/terms" className="text-blue-600 hover:underline">
          Terms of Service
        </Link>
        <span className="mx-2">·</span>
        <Link to="/sms-terms" className="text-blue-600 hover:underline">
          SMS Terms
        </Link>
      </footer>
    </div>
  );
}
export default App;
