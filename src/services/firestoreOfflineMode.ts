import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const MODE_PREFIX = 'basechan_firestore_quota_offline_v2:';
const RETRY_PREFIX = 'basechan_firestore_quota_retry_at_v2:';
const MODE_EVENT = 'basechan-firestore-mode-change';
const PROBE_EVENT = 'basechan-firestore-quota-probe';
export const QUOTA_RETRY_INTERVAL_MS = 12 * 60 * 60 * 1000;

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

export function isQuotaOffline(uid: string = auth.currentUser?.uid || ''): boolean {
  if (!uid) return false;
  try { return inMemoryModes.has(uid) || localStorage.getItem(modeKey(uid)) === '1'; }
  catch { return inMemoryModes.has(uid); }
}

export function getQuotaRetryAt(uid: string): number {
  try {
    const saved = Number(localStorage.getItem(retryKey(uid)));
    if (Number.isFinite(saved) && saved > 0) return saved;
  } catch { /* use a predictable in-memory retry interval */ }
  const next = Date.now() + QUOTA_RETRY_INTERVAL_MS;
  try { localStorage.setItem(retryKey(uid), String(next)); } catch { /* session can still retry */ }
  return next;
}

function scheduleNextQuotaCheck(uid: string) {
  try { localStorage.setItem(retryKey(uid), String(Date.now() + QUOTA_RETRY_INTERVAL_MS)); }
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
  inMemoryModes.delete(uid);
  try { localStorage.removeItem(modeKey(uid)); localStorage.removeItem(retryKey(uid)); } catch { /* memory state is cleared */ }
  announce(uid);
}

export async function clearQuotaState(uid: string): Promise<void> {
  inMemoryModes.delete(uid);
  try {
    localStorage.removeItem(modeKey(uid)); localStorage.removeItem(retryKey(uid));
    localStorage.removeItem('basechan_firestore_quota_offline_v1');
    localStorage.removeItem('basechan_firestore_quota_retry_at_v1');
  } catch { /* ignore unavailable storage */ }
  announce(uid);
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
