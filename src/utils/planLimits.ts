/** Plan limit / subscription errors returned by the API with a `code` field. */

export function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export function isPlanLimitError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code) {
    return (
      code === 'EMAIL_LIMIT_REACHED' ||
      code === 'SMS_LIMIT_REACHED' ||
      code === 'SMS_NOT_INCLUDED' ||
      code === 'SUBSCRIPTION_INACTIVE' ||
      code === 'PLAN_LIMIT'
    );
  }
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return /limit reached|not included on your plan|subscription is not active/i.test(msg);
}

export function planLimitTitle(error: unknown): string {
  const code = getErrorCode(error);
  if (code === 'SMS_LIMIT_REACHED' || code === 'SMS_NOT_INCLUDED') return 'SMS limit reached';
  if (code === 'SUBSCRIPTION_INACTIVE') return 'Subscription inactive';
  return 'Email limit reached';
}

/** Shows a popup and optionally navigates to the Plan page. */
export function alertPlanLimit(error: unknown, goToPlan?: () => void): void {
  const message =
    error instanceof Error ? error.message : 'You have reached your plan limit for this billing period.';
  const title = planLimitTitle(error);
  const wantsUpgrade = window.confirm(
    `${title}\n\n${message}\n\nOpen the Plan page to upgrade or manage billing?`,
  );
  if (wantsUpgrade && goToPlan) goToPlan();
}
