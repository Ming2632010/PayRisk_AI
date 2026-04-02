import { useEffect, useState } from 'react';
import { Shield, LayoutDashboard, Users, Mail, LogOut, Sliders, CreditCard, Bell, FileText } from 'lucide-react';
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

  useEffect(() => {
    checkUser();
  }, []);

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
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">PayRisk AI</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigateTo('dashboard')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    currentPage === 'dashboard'
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </button>
                <button
                  onClick={() => navigateTo('customers')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    currentPage === 'customers'
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Customers
                </button>
                <button
                  onClick={() => navigateTo('email-settings')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    currentPage === 'email-settings'
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  Email Templates
                </button>
                <button
                  onClick={() => navigateTo('invoice')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    currentPage === 'invoice'
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Invoice
                </button>
                <button
                  onClick={() => navigateTo('custom-rules')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    currentPage === 'custom-rules'
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  Custom Rules
                </button>
                <button
                  onClick={() => navigateTo('plan')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    currentPage === 'plan'
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Plan
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">{user.email}</div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
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
              onClick={() => navigateTo('customers')}
              className="text-sm font-medium text-amber-800 underline hover:no-underline"
            >
              Go to Customers to send reminder or SMS
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'customers' && <CustomerManagement userId={user?.id ?? null} onDueTodayRefresh={() => api.customers.dueToday().then(setDueToday).catch(() => setDueToday(null))} />}
        {currentPage === 'email-settings' && <EmailSettings />}
        {currentPage === 'invoice' && <InvoiceTemplateSettings />}
        {currentPage === 'custom-rules' && <CustomRules />}
        {currentPage === 'plan' && <SubscriptionPlan />}
      </main>
    </div>
  );
}
export default App;
