export const ONBOARDING_COMPLETED_KEY = 'chloe-onboarding-completed';
export const ONBOARDING_SKIPPED_KEY = 'chloe-onboarding-skipped';

export function isOnboardingCompleted() {
  return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
}

export function markCompleted() {
  localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
}

export function isOnboardingSkipped() {
  return localStorage.getItem(ONBOARDING_SKIPPED_KEY) === 'true';
}

export function markSkipped() {
  localStorage.setItem(ONBOARDING_SKIPPED_KEY, 'true');
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
  localStorage.removeItem(ONBOARDING_SKIPPED_KEY);
}
