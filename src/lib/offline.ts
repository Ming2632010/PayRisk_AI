/**
 * Offline cache and sync queue for PayRisk AI.
 * - Caches customers list locally so it can be shown when offline.
 * - Queues create/update/delete actions when offline and replays them when back online.
 */

const CACHE_KEY = 'payrisk_customers_cache';
const CACHE_TIME_KEY = 'payrisk_customers_cache_time';
const QUEUE_KEY = 'payrisk_pending_actions';
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export type PendingAction =
  | { type: 'create_customer'; payload: Record<string, unknown> }
  | { type: 'update_customer'; id: number; payload: Record<string, unknown> }
  | { type: 'delete_customer'; id: number }
  | { type: 'create_transaction'; customerId: number; payload: Record<string, unknown> }
  | { type: 'update_transaction'; id: number; customerId: number; payload: Record<string, unknown> }
  | { type: 'delete_transaction'; id: number; customerId: number };

function getStorage(): Storage {
  if (typeof window === 'undefined') return {} as Storage;
  return window.localStorage;
}

export function getCachedCustomers(): unknown[] | null {
  try {
    const raw = getStorage().getItem(CACHE_KEY);
    const time = getStorage().getItem(CACHE_TIME_KEY);
    if (!raw || !time) return null;
    const age = Date.now() - parseInt(time, 10);
    if (age > MAX_CACHE_AGE_MS) return null;
    return JSON.parse(raw) as unknown[];
  } catch {
    return null;
  }
}

export function setCachedCustomers(customers: unknown[]): void {
  try {
    getStorage().setItem(CACHE_KEY, JSON.stringify(customers));
    getStorage().setItem(CACHE_TIME_KEY, String(Date.now()));
  } catch (e) {
    console.warn('Offline cache write failed', e);
  }
}

export function getPendingQueue(): PendingAction[] {
  try {
    const raw = getStorage().getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingAction[];
  } catch {
    return [];
  }
}

function setPendingQueue(queue: PendingAction[]): void {
  try {
    getStorage().setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Pending queue write failed', e);
  }
}

export function addToPendingQueue(action: PendingAction): void {
  const queue = getPendingQueue();
  queue.push(action);
  setPendingQueue(queue);
}

export function clearPendingQueue(): void {
  setPendingQueue([]);
}

export function isLikelyNetworkError(e: unknown): boolean {
  if (e instanceof TypeError && e.message === 'Failed to fetch') return true;
  if (e instanceof Error && (e.message.includes('fetch') || e.message.includes('network'))) return true;
  return false;
}

/** API shape required by processQueue. Use this type when passing your api (e.g. processQueue(api as ProcessQueueApi)). */
export type ProcessQueueApi = {
  customers: {
    create: (body: Record<string, unknown>) => Promise<unknown>;
    update: (id: number, body: Record<string, unknown>) => Promise<unknown>;
    delete: (id: number) => Promise<void>;
  };
  transactions: {
    create: (body: Record<string, unknown>) => Promise<unknown>;
    update: (id: number, body: Record<string, unknown>) => Promise<unknown>;
    delete: (id: number) => Promise<void>;
  };
};

/** Process pending actions when back online. Call with the api object. Returns { processed, errors }. */
export async function processQueue(api: ProcessQueueApi): Promise<{ processed: number; errors: number }> {
  const queue = getPendingQueue();
  if (queue.length === 0) return { processed: 0, errors: 0 };
  let processed = 0;
  let errors = 0;
  const remaining: PendingAction[] = [];
  for (const action of queue) {
    try {
      switch (action.type) {
        case 'create_customer':
          await api.customers.create(action.payload);
          processed++;
          break;
        case 'update_customer':
          await api.customers.update(action.id, action.payload);
          processed++;
          break;
        case 'delete_customer':
          await api.customers.delete(action.id);
          processed++;
          break;
        case 'create_transaction':
          await api.transactions.create({ ...action.payload, customer_id: action.customerId } as Record<string, unknown>);
          processed++;
          break;
        case 'update_transaction':
          await api.transactions.update(action.id, action.payload);
          processed++;
          break;
        case 'delete_transaction':
          await api.transactions.delete(action.id);
          processed++;
          break;
        default:
          remaining.push(action);
      }
    } catch {
      errors++;
      remaining.push(action);
    }
  }
  setPendingQueue(remaining);
  return { processed, errors };
}
