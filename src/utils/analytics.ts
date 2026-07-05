import { logEvent } from 'firebase/analytics';
import { analytics } from '../firebaseConfig';
import { ANALYTICS_EVENTS } from '@shared/constants';

export function logAnalyticsEvent(
  eventName: string,
  params?: Record<string, string | number>
): void {
  if (!analytics) return;
  logEvent(analytics, eventName, params);
}

/** Dedupe deck_published per project per browser session */
export function logDeckPublishedOnce(
  projectId: string,
  params: { grade_level: string; subject: string }
): void {
  const key = `analytics_published_${projectId}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  logAnalyticsEvent(ANALYTICS_EVENTS.DECK_PUBLISHED, {
    project_id: projectId,
    ...params,
  });
}

export type PendingAuthMethod = 'google' | 'email_link';
let pendingAuthMethod: PendingAuthMethod | null = null;

export function setPendingAuthMethod(method: PendingAuthMethod): void {
  pendingAuthMethod = method;
}

export function consumePendingAuthMethod(): PendingAuthMethod | null {
  const m = pendingAuthMethod;
  pendingAuthMethod = null;
  return m;
}

export function clearPendingAuthMethod(): void {
  pendingAuthMethod = null;
}
