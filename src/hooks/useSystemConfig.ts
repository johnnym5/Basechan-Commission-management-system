import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SystemConfig {
  defaultIntake: string;
  updatedAt?: string;
  updatedBy?: string;
}

export function useSystemConfig() {
  const [defaultIntake, setDefaultIntake] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);

    const docRef = doc(db, 'settings', 'system_config');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as SystemConfig;
          if (data.defaultIntake) {
            setDefaultIntake(data.defaultIntake);
          }
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching system config:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const updateDefaultIntake = async (newDefaultIntake: string, userEmail: string) => {
    if (!newDefaultIntake) return;
    const docRef = doc(db, 'settings', 'system_config');

    await setDoc(
      docRef,
      {
        defaultIntake: newDefaultIntake.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: userEmail,
      },
      { merge: true }
    );
  };

  return { defaultIntake, loading, updateDefaultIntake };
}
