import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import type { AgentAccessRequest, UserAccess, UserRole } from '../types';
import { hasValidCachedAdminMembership, isAdminMembershipValid, isApprovedAdminEmail, resolveUserAccess } from '../services/accessPolicy';
import { buildUserProfileRecord } from '../services/authProfile';
import { clearQuotaState, enterQuotaOfflineMode, isConnectivityError, isQuotaError, isQuotaOffline, subscribeToFirestoreMode } from '../services/firestoreOfflineMode';
import { deleteLocalRateDatabase, getLocalRateMetadata, saveLocalRateMetadata } from '../services/localRateDatabase';
import { assertFirestoreWritesAllowed } from '../services/firestoreWriteGuard';

async function resolveCachedAccess(currentUser: User): Promise<SyncResult> {
  const email = currentUser.email || '';
  const metadata = await getLocalRateMetadata(currentUser.uid).catch(() => null);
  const cachedAdminMembership = hasValidCachedAdminMembership({
    uid: currentUser.uid,
    email,
    emailVerified: currentUser.emailVerified,
    metadata,
  });
  const baseAccess = resolveUserAccess({
    email,
    emailVerified: currentUser.emailVerified,
    adminMembershipVerified: cachedAdminMembership,
  });
  if (baseAccess.role === 'AGENT' && metadata?.complete && metadata.role === 'AGENT' && metadata.organizationId) {
    const request: AgentAccessRequest = {
      uid: currentUser.uid,
      email,
      displayName: currentUser.displayName || '',
      status: 'approved',
      organizationId: metadata.organizationId,
      createdAt: metadata.lastVerifiedAt,
      updatedAt: metadata.lastVerifiedAt,
    };
    return {
      access: resolveUserAccess({ email, emailVerified: currentUser.emailVerified, accessRequest: { status: 'approved', organizationId: metadata.organizationId } }),
      accessRequest: request,
      isDisabled: false,
    };
  }
  return { access: baseAccess, accessRequest: null, isDisabled: false };
}

export const determineUserRole = (email: string): UserRole => resolveUserAccess({ email }).role;

interface SyncResult {
  access: UserAccess;
  accessRequest: AgentAccessRequest | null;
  isDisabled: boolean;
}

async function cacheAdminMembership(uid: string, email: string, verified: boolean): Promise<void> {
  const previous = await getLocalRateMetadata(uid).catch(() => null);
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();
  const role = verified ? 'ADMIN' : previous?.role === 'ADMIN' ? 'AGENT' : previous?.role || 'AGENT';
  await saveLocalRateMetadata(uid, {
    ...(previous || {}),
    id: 'scope',
    uid,
    role,
    complete: previous?.complete === true && previous.role === role,
    cursors: previous?.cursors || {},
    lastSyncedAt: previous?.lastSyncedAt || now,
    lastVerifiedAt: now,
    adminMembershipVerified: verified,
    ...(verified ? { adminEmail: normalizedEmail } : { adminEmail: undefined }),
  });
}

interface AuthContextType {
  user: User | null;
  role: UserRole;
  access: UserAccess;
  accessRequest: AgentAccessRequest | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  setUserDisabledStatus: (uid: string, isDisabled: boolean) => Promise<void>;
  deleteUserRecord: (uid: string) => Promise<void>;
}

const INITIAL_ACCESS: UserAccess = { role: 'AGENT', accessState: 'not_requested' };
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<UserAccess>(INITIAL_ACCESS);
  const [accessRequest, setAccessRequest] = useState<AgentAccessRequest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [quotaMode, setQuotaMode] = useState(() => isQuotaOffline(user?.uid));

  useEffect(() => subscribeToFirestoreMode((uid) => {
    if (!uid || uid === user?.uid) setQuotaMode(isQuotaOffline(user?.uid));
  }), [user?.uid]);

  const requireVerifiedEmail = async (currentUser: User) => {
    if (!currentUser.emailVerified) {
      await firebaseSignOut(auth);
      setUser(null);
      setAccess(INITIAL_ACCESS);
      setAccessRequest(null);
      throw new Error('Please verify your email using the link we sent before signing in.');
    }
  };

  const syncUserData = async (currentUser: User): Promise<SyncResult> => {
    const email = currentUser.email || '';
    const fallbackAccess = resolveUserAccess({ email, emailVerified: currentUser.emailVerified });
    if (!navigator.onLine || isQuotaOffline(currentUser.uid)) return resolveCachedAccess(currentUser);
    try {
      let adminMembershipVerified = false;
      if (isApprovedAdminEmail(email)) {
        const membershipSnap = await getDocFromServer(doc(db, 'admins', currentUser.uid));
        adminMembershipVerified = membershipSnap.exists() && isAdminMembershipValid({
          email,
          emailVerified: currentUser.emailVerified,
          membershipEmail: String(membershipSnap.data().email || ''),
        });
        await cacheAdminMembership(currentUser.uid, email, adminMembershipVerified);
      }
      const resolvedAccess = resolveUserAccess({
        email,
        emailVerified: currentUser.emailVerified,
        adminMembershipVerified,
      });
      const userDocRef = doc(db, 'users', currentUser.uid);
      const snap = await getDocFromServer(userDocRef);
      const snapData = snap.exists() ? snap.data() : null;
      const isDisabled = snapData?.isDisabled === true;
      if (isDisabled) return { access: resolvedAccess, accessRequest: null, isDisabled: true };

      if (!snap.metadata.fromCache) assertFirestoreWritesAllowed('Account profile');
      if (!snap.metadata.fromCache) await setDoc(
        userDocRef,
        buildUserProfileRecord(
          {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
          },
          snapData ? { createdAt: snapData.createdAt as string | undefined } : null
        ),
        { merge: true }
      );

      let request: AgentAccessRequest | null = null;
      if (resolvedAccess.role === 'AGENT') {
        const requestSnap = await getDocFromServer(doc(db, 'agent_access_requests', currentUser.uid));
        request = requestSnap.exists() ? requestSnap.data() as AgentAccessRequest : null;
      }

      return {
        access: resolveUserAccess({
          email,
          emailVerified: currentUser.emailVerified,
          adminMembershipVerified,
          accessRequest: request
            ? { status: request.status, organizationId: request.organizationId || '' }
            : undefined,
        }),
        accessRequest: request,
        isDisabled: false,
      };
    } catch (err) {
      if (isQuotaError(err)) await enterQuotaOfflineMode(currentUser.uid);
      if (isQuotaError(err) || isConnectivityError(err) || !navigator.onLine) return resolveCachedAccess(currentUser);
      console.error('Error syncing user record to Firestore:', err);
      return { access: fallbackAccess, accessRequest: null, isDisabled: false };
    }
  };

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        if (!active) return;
        setUser(null);
        setQuotaMode(false);
        setAccess(INITIAL_ACCESS);
        setAccessRequest(null);
        setError(null);
        setLoading(false);
        return;
      }

      const result = await syncUserData(currentUser);
      if (!active) return;
      if (result.isDisabled) {
        await deleteLocalRateDatabase(currentUser.uid).catch(() => {});
        await clearQuotaState(currentUser.uid);
        await firebaseSignOut(auth);
        setUser(null);
        setAccess(INITIAL_ACCESS);
        setAccessRequest(null);
        setError('Access Revoked: Your account has been disabled by an administrator.');
      } else {
        setUser(currentUser);
        setQuotaMode(isQuotaOffline(currentUser.uid));
        setAccess(result.access);
        setAccessRequest(result.accessRequest);
        setError(null);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || quotaMode) return;
    const userDocRef = doc(db, 'users', user.uid);
    return onSnapshot(
      userDocRef,
      async (snap) => {
        if (snap.data()?.isDisabled === true) {
          await firebaseSignOut(auth);
          setUser(null);
          setAccess(INITIAL_ACCESS);
          setAccessRequest(null);
          setError('Access Revoked: Your account has been disabled by an administrator.');
        }
      },
      (err) => console.error('Error in real-time user document listener:', err)
    );
  }, [user, quotaMode]);

  useEffect(() => {
    if (!user || access.role !== 'ADMIN' || quotaMode) return;
    const revokeCachedAdminAccess = () => {
      void cacheAdminMembership(user.uid, user.email || '', false).catch((err) => {
        console.error('Could not quarantine cached Admin access:', err);
      });
      setAccess(resolveUserAccess({
        email: user.email,
        emailVerified: user.emailVerified,
        adminMembershipVerified: false,
        accessRequest: accessRequest
          ? { status: accessRequest.status, organizationId: accessRequest.organizationId || '' }
          : undefined,
      }));
      setAccessRequest(null);
    };
    return onSnapshot(
      doc(db, 'admins', user.uid),
      (snapshot) => {
        if (snapshot.metadata.fromCache) return;
        const stillAdmin = snapshot.exists() && isAdminMembershipValid({
          email: user.email,
          emailVerified: user.emailVerified,
          membershipEmail: String(snapshot.data().email || ''),
        });
        if (!stillAdmin) revokeCachedAdminAccess();
      },
      (err) => {
        if (err.code === 'permission-denied') {
          revokeCachedAdminAccess();
        } else {
          console.error('Error listening to Admin membership:', err);
        }
      }
    );
  }, [user?.uid, access.role, quotaMode]);

  useEffect(() => {
    if (!user || quotaMode || access.role !== 'AGENT') return;
    return onSnapshot(
      doc(db, 'agent_access_requests', user.uid),
      (snap) => {
        const request = snap.exists() ? snap.data() as AgentAccessRequest : null;
        setAccessRequest(request);
        setAccess(resolveUserAccess({
          email: user.email,
          emailVerified: user.emailVerified,
          accessRequest: request
            ? { status: request.status, organizationId: request.organizationId || '' }
            : undefined,
        }));
      },
      (err) => console.error('Error listening to organization access status:', err)
    );
  }, [user?.uid, access.role, quotaMode]);

  useEffect(() => {
    const handleUnload = () => {
      if (user && navigator.onLine && !isQuotaOffline(user.uid)) updateDoc(doc(db, 'users', user.uid), { isOnline: false }).catch(() => {});
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [user]);

  const signInWithGoogle = async () => {
    try {
      setError(null);
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        const syncResult = await syncUserData(result.user);
        if (syncResult.isDisabled) {
          await firebaseSignOut(auth);
          setUser(null);
          setAccess(INITIAL_ACCESS);
          setAccessRequest(null);
          setError('Access Revoked: Your account has been disabled by an administrator.');
        } else {
          setUser(result.user);
          setAccess(syncResult.access);
          setAccessRequest(syncResult.accessRequest);
        }
      }
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Google sign-in failed. Please try again.';
      setError(errMessage);
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      await requireVerifiedEmail(result.user);
      const syncResult = await syncUserData(result.user);
      if (syncResult.isDisabled) {
        await firebaseSignOut(auth);
        setError('Access Revoked: Your account has been disabled by an administrator.');
        return;
      }
      setUser(result.user);
      setAccess(syncResult.access);
      setAccessRequest(syncResult.accessRequest);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Email sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (name: string, email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      const trimmedName = name.trim();
      const normalizedEmail = email.trim().toLowerCase();
      if (!trimmedName) throw new Error('Enter your name to create an account.');
      const result = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      await updateProfile(result.user, { displayName: trimmedName });
      await sendEmailVerification(result.user);
      await firebaseSignOut(auth);
      setError('Account created. Check your inbox and verify your email before signing in.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Email sign-up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      setError(null);
      setLoading(true);
      await sendPasswordResetEmail(auth, email.trim());
      setError('If an account exists for that email, a password reset link has been sent.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send a password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const current = user;
      setUser(null);
      setAccess(INITIAL_ACCESS);
      setAccessRequest(null);
      if (current) {
        if (navigator.onLine && !isQuotaOffline(current.uid)) await updateDoc(doc(db, 'users', current.uid), { isOnline: false }).catch(() => {});
        await Promise.all([deleteLocalRateDatabase(current.uid).catch(() => {}), clearQuotaState(current.uid)]);
      }
      await firebaseSignOut(auth);
      setUser(null);
      setAccess(INITIAL_ACCESS);
      setAccessRequest(null);
      setError(null);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const setUserDisabledStatus = async (uid: string, isDisabled: boolean) => {
    assertFirestoreWritesAllowed('Account access changes');
    await updateDoc(doc(db, 'users', uid), {
      isDisabled,
      isOnline: false,
      disabledAt: isDisabled ? new Date().toISOString() : null,
    });
  };

  const deleteUserRecord = async (uid: string) => {
    assertFirestoreWritesAllowed('Account deletion');
    await deleteDoc(doc(db, 'users', uid));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: access.role,
        access,
        accessRequest,
        loading,
        error,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        signOut,
        clearError: () => setError(null),
        setUserDisabledStatus,
        deleteUserRecord,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      role: 'AGENT',
      access: { role: 'AGENT', accessState: 'approved', organizationId: undefined },
      accessRequest: null,
      loading: false,
      error: null,
      signInWithGoogle: async () => {},
      signInWithEmail: async () => {},
      signUpWithEmail: async () => {},
      sendPasswordReset: async () => {},
      signOut: async () => {},
      clearError: () => {},
      setUserDisabledStatus: async () => {},
      deleteUserRecord: async () => {},
    };
  }
  return context;
};
