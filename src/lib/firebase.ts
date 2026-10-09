import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Rate data lives in the account-scoped repository. Keep Firestore's other
// cached documents in memory so sign-out cannot leave another persistent copy.
export const db = (() => {
  const hotData = import.meta.hot?.data as { firestore?: ReturnType<typeof getFirestore> } | undefined;
  if (hotData?.firestore) return hotData.firestore;

  try {
    const instance = initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
    if (import.meta.hot?.data) import.meta.hot.data.firestore = instance;
    return instance;
  } catch (error) {
    // Vite may re-evaluate this module while the previous Firestore singleton
    // remains alive. Reuse that instance only for this known HMR case.
    const message = error instanceof Error ? error.message : '';
    if (message.includes('initializeFirestore() has already been called with different options')) {
      const instance = getFirestore(app);
      if (import.meta.hot?.data) import.meta.hot.data.firestore = instance;
      return instance;
    }
    throw error;
  }
})();

export default app;
