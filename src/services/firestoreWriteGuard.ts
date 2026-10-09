import { auth } from '../lib/firebase';
import { isQuotaOffline } from './firestoreOfflineMode';

export function assertFirestoreWritesAllowed(action = 'This action'): void {
  const uid = auth.currentUser?.uid || '';
  if (isQuotaOffline(uid) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    throw new Error(`${action} needs an online database connection. Your offline search data is safe.`);
  }
}
