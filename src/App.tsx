import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginView } from './components/LoginView';
import { AppLayout } from './components/AppLayout';
import { LoadingScreen } from './components/LoadingScreen';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Authenticating with Basechan CMS..." />;
  }

  if (!user) {
    return <LoginView />;
  }

  return <AppLayout />;
};

const FirestoreQueueRecoveryNotice: React.FC = () => {
  const [needsReload, setNeedsReload] = useState(false);

  useEffect(() => {
    const isFirestoreAssertion = (value: unknown) => {
      const message = value instanceof Error ? value.message : typeof value === 'string' ? value : '';
      return message.includes('FIRESTORE') && message.includes('INTERNAL ASSERTION FAILED');
    };
    const onError = (event: ErrorEvent) => {
      if (isFirestoreAssertion(event.error) || isFirestoreAssertion(event.message)) setNeedsReload(true);
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isFirestoreAssertion(event.reason)) setNeedsReload(true);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  if (!needsReload) return null;
  return (
    <div role="alertdialog" aria-labelledby="firestore-recovery-title" className="fixed inset-x-0 bottom-0 z-[10000] border-t border-rose-300 bg-rose-50 p-4 text-rose-950 shadow-2xl dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="firestore-recovery-title" className="text-sm font-extrabold">Database connection needs a refresh</h2>
          <p className="mt-1 text-xs">The database client stopped responding. Reload the app to reconnect and continue.</p>
        </div>
        <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-rose-800 dark:bg-rose-200 dark:text-rose-950 dark:hover:bg-white">Reload app</button>
      </div>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FirestoreQueueRecoveryNotice />
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
