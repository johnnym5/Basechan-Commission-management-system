import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import type { UserRole } from '../types';

export const determineUserRole = (email: string): UserRole => {
  const lower = email.toLowerCase().trim();
  // Admin rule: @basechaninternational.com
  if (lower.endsWith('@basechaninternational.com')) {
    return 'ADMIN';
  }
  // Staff rule: .basechaninternational@gmail.com
  if (
    lower.includes('basechaninternational@gmail.com') ||
    lower.includes('.basechaninternational@gmail.com')
  ) {
    return 'STAFF';
  }
  // Agent rule: Any other email
  return 'AGENT';
};

interface SyncResult {
  role: UserRole;
  isDisabled: boolean;
}

interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  updateUserRole: (uid: string, newRole: UserRole) => Promise<void>;
  setUserDisabledStatus: (uid: string, isDisabled: boolean) => Promise<void>;
  deleteUserRecord: (uid: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('AGENT');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const syncUserData = async (currentUser: User): Promise<SyncResult> => {
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const snap = await getDoc(userDocRef);
      const email = currentUser.email || '';
      const derivedRole = determineUserRole(email);

      const snapData = snap.exists() ? snap.data() : null;
      const isDisabled = snapData?.isDisabled === true;
      const assignedRole: UserRole = snapData?.role ? (snapData.role as UserRole) : derivedRole;

      if (isDisabled) {
        return { role: assignedRole, isDisabled: true };
      }

      const now = new Date().toISOString();
      const userData = {
        uid: currentUser.uid,
        email: email,
        displayName: currentUser.displayName || email.split('@')[0] || 'User',
        photoURL: currentUser.photoURL || '',
        role: assignedRole,
        lastLoginAt: now,
        createdAt: snapData?.createdAt || now,
        isOnline: true,
        isDisabled: false,
      };

      await setDoc(userDocRef, userData, { merge: true });
      return { role: assignedRole, isDisabled: false };
    } catch (err) {
      console.error('Error syncing user record to Firestore:', err);
      return { role: determineUserRole(currentUser.email || ''), isDisabled: false };
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const result = await syncUserData(currentUser);
        if (result.isDisabled) {
          await firebaseSignOut(auth);
          setUser(null);
          setRole('AGENT');
          setError('Access Revoked: Your account has been disabled by an administrator.');
        } else {
          setUser(currentUser);
          setRole(result.role);
          setError(null);
        }
      } else {
        setUser(null);
        setRole('AGENT');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Update online status to false on tab/window close
  useEffect(() => {
    const handleUnload = () => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        updateDoc(userDocRef, { isOnline: false }).catch(() => {});
      }
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
        const syncRes = await syncUserData(result.user);
        if (syncRes.isDisabled) {
          await firebaseSignOut(auth);
          setUser(null);
          setRole('AGENT');
          setError('Access Revoked: Your account has been disabled by an administrator.');
        } else {
          setUser(result.user);
          setRole(syncRes.role);
        }
      }
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Google sign-in failed. Please try again.';
      setError(errMessage);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, { isOnline: false }).catch(() => {});
      }
      await firebaseSignOut(auth);
      setUser(null);
      setRole('AGENT');
      setError(null);
    } catch (err: unknown) {
      console.error('Error signing out:', err);
    }
  };

  const updateUserRole = async (uid: string, newRole: UserRole) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, { role: newRole });
      if (user && user.uid === uid) {
        setRole(newRole);
      }
    } catch (err) {
      console.error('Error updating user role:', err);
      throw err;
    }
  };

  const setUserDisabledStatus = async (uid: string, isDisabled: boolean) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, {
        isDisabled,
        isOnline: isDisabled ? false : false, // Reset online status if disabled
      });
    } catch (err) {
      console.error('Error setting user disabled status:', err);
      throw err;
    }
  };

  const deleteUserRecord = async (uid: string) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      await deleteDoc(userDocRef);
    } catch (err) {
      console.error('Error deleting user record:', err);
      throw err;
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        error,
        signInWithGoogle,
        signOut,
        clearError,
        updateUserRole,
        setUserDisabledStatus,
        deleteUserRecord
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
