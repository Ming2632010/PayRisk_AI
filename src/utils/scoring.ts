import type { CustomerNew } from '../lib/database.types';

export function calculateRiskScore(customer: CustomerNew): number {
  let score = 0;

  if (customer.due_date) {
    const dueDate = new Date(customer.due_date);
    const today = new Date();
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue > 7) {
      score += 20;
    }
    if (daysOverdue > 30) {
      score += 40;
    }
  }

  if (customer.total_orders === 0) {
    score += 30;
  }

  if (customer.is_high_risk_industry) {
    score += 20;
  }

  return Math.min(score, 100);
}

export function calculateRepurchaseScore(customer: CustomerNew): number {
  let score = 50;

  if (customer.total_orders > 5) {
    score += 20;
  } else if (customer.total_orders > 2) {
    score += 10;
  }

  if (customer.last_purchase_date) {
    const lastPurchase = new Date(customer.last_purchase_date);
    const today = new Date();
    const daysSinceLastPurchase = Math.floor(
      (today.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastPurchase <= 30) {
      score += 25;
    } else if (daysSinceLastPurchase <= 60) {
      score += 15;
    } else if (daysSinceLastPurchase <= 90) {
      score += 5;
    } else {
      score -= 20;
    }
  } else {
    score -= 30;
  }

  if (customer.average_order_value > 1000) {
    score += 15;
  } else if (customer.average_order_value > 500) {
    score += 10;
  } else if (customer.average_order_value > 100) {
    score += 5;
  }

  return Math.max(0, Math.min(score, 100));
}

export function getRiskLabel(score: number): { text: string; emoji: string; color: string } {
  if (score >= 60) {
    return { text: 'High Risk', emoji: '🔴', color: 'text-red-600' };
  } else if (score >= 40) {
    return { text: 'Medium Risk', emoji: '🟡', color: 'text-yellow-600' };
  } else {
    return { text: 'Low Risk', emoji: '🟢', color: 'text-green-600' };
  }
}

export function getRepurchaseLabel(score: number): { text: string; emoji: string; color: string } {
  if (score >= 80) {
    return { text: 'High Intent', emoji: '🔥', color: 'text-orange-600' };
  } else if (score >= 50) {
    return { text: 'Medium Intent', emoji: '😐', color: 'text-blue-600' };
  } else {
    return { text: 'Low Intent', emoji: '💤', color: 'text-gray-600' };
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
