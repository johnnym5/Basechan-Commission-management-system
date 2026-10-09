import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { clearIndexedDbPersistence } from 'firebase/firestore'
import './index.css'
import App from './App'
import { db } from './lib/firebase'

const CACHE_MIGRATION_KEY = 'basechan-firestore-memory-cache-migrated-v1';

async function mountApp() {
  try {
    if (localStorage.getItem(CACHE_MIGRATION_KEY) !== '1') {
      await clearIndexedDbPersistence(db);
      localStorage.setItem(CACHE_MIGRATION_KEY, '1');
    }
  } catch (error) {
    console.warn('Could not clear the previous Firestore persistent cache:', error);
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void mountApp();

// Register Service Worker for PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('PWA ServiceWorker registered successfully:', reg.scope);
      })
      .catch((err) => {
        console.warn('PWA ServiceWorker registration failed:', err);
      });
  });
} else if ('serviceWorker' in navigator) {
  // Do not let a previously installed production worker serve stale Vite
  // modules while running this app on localhost or 127.0.0.1.
  window.addEventListener('load', () => {
    const devWorkerRefreshKey = 'basechan-dev-worker-cleared';
    navigator.serviceWorker.getRegistrations()
      .then(async (registrations) => {
        if (!registrations.length) {
          sessionStorage.removeItem(devWorkerRefreshKey);
          return;
        }
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if (navigator.serviceWorker.controller && !sessionStorage.getItem(devWorkerRefreshKey)) {
          sessionStorage.setItem(devWorkerRefreshKey, '1');
          window.location.reload();
        }
      })
      .catch((err) => console.warn('Could not unregister development service workers:', err));
  });
}
