import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const MODE_PREFIX = 'basechan_firestore_quota_offline_v2:';
const RETRY_PREFIX = 'basechan_firestore_quota_retry_at_v2:';
const MODE_EVENT = 'basechan-firestore-mode-change';
const PROBE_EVENT = 'basechan-firestore-quota-probe';

/**
 * Calculates the exact timestamp of the next daily Firebase quota reset.
 * Firebase quota resets globally at 00:00 PST = 08:00 AM WAT (UTC+1).
 */
export function getNextDailyQuotaResetTime(): number {
  const now = new Date();
  // 08:00 UTC = 08:00 WAT
  const resetToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0, 0));

  if (now.getTime() >= resetToday.getTime()) {
    // If today's 08:00 WAT has already passed, the next reset is tomorrow at 08:00 WAT
    resetToday.setUTCDate(resetToday.getUTCDate() + 1);
  }
  return resetToday.getTime();
}

const modeKey = (uid: string) => `${MODE_PREFIX}${uid}`;
const retryKey = (uid: string) => `${RETRY_PREFIX}${uid}`;
const inMemoryModes = new Set<string>();
const channels = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('basechan-firestore-mode');
let networkChange: Promise<void> | null = null;

function announce(uid?: string) {
  window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: { uid } }));
  channels?.postMessage({ uid });
}

channels?.addEventListener('message', (event) => {
  window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: { uid: event.data?.uid } }));
});

/**
 * Universally clears all quota-offline locks and retry keys across localStorage
 * and in-memory sets for all accounts.
 */
export function clearAllQuotaStorage(): void {
  inMemoryModes.clear();
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('basechan_firestore_quota') || key.includes('quota_offline') || key.includes('quota_retry'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {}
}

export function isQuotaOffline(uid: string = auth.currentUser?.uid || ''): boolean {
  if (!uid) return false;

  try {
    const isOffline = inMemoryModes.has(uid) || localStorage.getItem(modeKey(uid)) === '1';
    if (!isOffline) return false;

    const retryAt = Number(localStorage.getItem(retryKey(uid)));
    const now = new Date();

    // Auto-expire offline quota lock if retry timestamp is missing, past Date.now(), or from a previous day
    if (!Number.isFinite(retryAt) || retryAt <= 0 || Date.now() >= retryAt) {
      clearAllQuotaStorage();
      return false;
    }

    const lastRetryDate = new Date(retryAt);
    if (now.getUTCDate() !== lastRetryDate.getUTCDate() || now.getUTCMonth() !== lastRetryDate.getUTCMonth()) {
      clearAllQuotaStorage();
      return false;
    }

    return true;
  } catch {
    return inMemoryModes.has(uid);
  }
}

export function getQuotaRetryAt(uid: string): number {
  try {
    const saved = Number(localStorage.getItem(retryKey(uid)));
    if (Number.isFinite(saved) && saved > 0) return saved;
  } catch { /* use calculated daily reset time */ }
  const next = getNextDailyQuotaResetTime();
  try { localStorage.setItem(retryKey(uid), String(next)); } catch { /* session can still retry */ }
  return next;
}

function scheduleNextQuotaCheck(uid: string) {
  const nextResetTime = getNextDailyQuotaResetTime();
  try { localStorage.setItem(retryKey(uid), String(nextResetTime)); }
  catch { /* use the standard interval for the next in-app check */ }
}

export function isQuotaError(error: unknown): boolean {
  const details = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
  const code = String(details.code || '').toLowerCase();
  return code === 'resource-exhausted' || code.endsWith('/resource-exhausted');
}

export function isConnectivityError(error: unknown): boolean {
  const details = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
  const code = String(details.code || '').toLowerCase();
  return ['unavailable', 'deadline-exceeded', 'network-request-failed'].some((part) => code.endsWith(part));
}

export async function enterQuotaOfflineMode(uid: string = auth.currentUser?.uid || ''): Promise<void> {
  if (!uid) return;
  const isNew = !isQuotaOffline(uid) || getQuotaRetryAt(uid) <= Date.now();
  inMemoryModes.add(uid);
  try {
    localStorage.setItem(modeKey(uid), '1');
    if (isNew) scheduleNextQuotaCheck(uid);
  } catch { /* the in-memory lock still blocks application writes */ }
  announce(uid);
  if (networkChange) await networkChange.catch(() => {});
  const disabling = disableNetwork(db);
  networkChange = disabling;
  try { await disabling; }
  finally { if (networkChange === disabling) networkChange = null; }
}

export async function lockFirestoreNetworkForQuota(): Promise<void> {
  if (networkChange) await networkChange.catch(() => {});
  const disabling = disableNetwork(db);
  networkChange = disabling;
  try { await disabling; }
  finally { if (networkChange === disabling) networkChange = null; }
}

export async function beginQuotaProbe(uid: string): Promise<void> {
  if (!uid || !isQuotaOffline(uid)) return;
  scheduleNextQuotaCheck(uid);
  if (networkChange) await networkChange.catch(() => {});
  const enabling = enableNetwork(db);
  networkChange = enabling;
  try { await enabling; }
  finally { if (networkChange === enabling) networkChange = null; }
  window.dispatchEvent(new CustomEvent(PROBE_EVENT, { detail: { uid } }));
}

export async function completeQuotaProbe(uid: string): Promise<void> {
  clearAllQuotaStorage();
  announce(uid);
}

export async function clearQuotaState(uid?: string): Promise<void> {
  clearAllQuotaStorage();
  announce(uid);
}

export async function forceGoOnline(uid?: string): Promise<void> {
  clearAllQuotaStorage();
  announce(uid);
  if (networkChange) await networkChange.catch(() => {});
  const enabling = enableNetwork(db);
  networkChange = enabling;
  try {
    await enabling;
  } catch (err) {
    console.error('Failed to enable Firestore network:', err);
  } finally {
    if (networkChange === enabling) networkChange = null;
  }
}

export function subscribeToFirestoreMode(callback: (uid?: string) => void): () => void {
  const handler = (event: Event) => callback((event as CustomEvent<{ uid?: string }>).detail?.uid);
  window.addEventListener(MODE_EVENT, handler);
  return () => window.removeEventListener(MODE_EVENT, handler);
}

export function subscribeToQuotaProbe(callback: (uid?: string) => void): () => void {
  const handler = (event: Event) => callback((event as CustomEvent<{ uid?: string }>).detail?.uid);
  window.addEventListener(PROBE_EVENT, handler);
  return () => window.removeEventListener(PROBE_EVENT, handler);
}
