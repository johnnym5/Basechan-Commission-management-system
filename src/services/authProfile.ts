export interface AuthProfileIdentity {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface UserProfileRecord {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: string;
  lastLoginAt: string;
  isOnline: true;
}

export function buildUserProfileRecord(
  identity: AuthProfileIdentity,
  existing: { createdAt?: string } | null,
  now: Date = new Date()
): UserProfileRecord {
  const email = identity.email?.trim() || '';
  const timestamp = now.toISOString();
  return {
    uid: identity.uid,
    email,
    displayName: identity.displayName?.trim() || email.split('@')[0] || 'User',
    photoURL: identity.photoURL || '',
    createdAt: existing?.createdAt || timestamp,
    lastLoginAt: timestamp,
    isOnline: true,
  };
}
